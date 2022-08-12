import EventService from "./EventService";
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Vec } from "@polkadot/types";
import { EventRecord } from "@polkadot/types/interfaces";
import TransactionSigner from "../transaction/TransactionSigner";
import { stringify } from "@polkadot/util";
import SlackWebhookPublisher from "../slack/SlackWebhookPublisher";
import { EventType } from "./EventType";
import { int } from "aws-sdk/clients/datapipeline";

const WS_ENDPONTS: string[] = [
  "wss://rpc.polkadot.io",
  "wss://polkadot.api.onfinality.io/public-ws",
  "wss://polkadot-rpc.dwellir.com/",
  "wss://public-rpc.pinknode.io/polkadot",
  "wss://polkadot.public.curie.radiumblock.io/ws"
]

export default class EventServiceImpl implements EventService {
    private currentBid: bigint
    private MAX_BID: bigint
    private slackPublisher = new SlackWebhookPublisher()
    private SLOT: number
    private BID_STEP: number
    private signer: TransactionSigner = new TransactionSigner(true, undefined)
    constructor() {
        const slot = process.env.SLOT ?? "2058"
        const step = process.env.BID_STEP ?? "3000"
        const max = process.env.MAX_BID ?? "100000"
        // should be the current highest bid in the auction: TODO - extract from chain
        const currentBid = process.env.CURRENT_BID ?? "0"
        this.SLOT = parseInt(slot)
        this.BID_STEP = parseInt(step)
        this.MAX_BID = BigInt(max)
        this.currentBid = BigInt(currentBid)
    }
    // Conversion factor for Polkadot Network
    private POLKADOT_NETWORK_VALUE = 10_000_000_000

    private api?: ApiPromise = undefined
    async start(): Promise<void> {
        console.info("Event Service Starting")
        const index = Math.floor(Math.random() * WS_ENDPONTS.length)
        const wsEndpoint: string =  WS_ENDPONTS[index]
        console.info(`Connecting to ${wsEndpoint}`)
        const provider: WsProvider = new WsProvider(wsEndpoint)
        try {
          this.api = await ApiPromise.create({ provider });
        } catch (e) {
          return this.start()
        }
        try {
          const [chain, nodeName, nodeVersion] = await Promise.all([
            this.api.rpc.system.chain(),
            this.api.rpc.system.name(),
            this.api.rpc.system.version()
          ]);
          console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

          const auctionCount = await this.api.query.auctions.auctionCounter()
          const auction = parseInt(auctionCount.toString())
          console.debug(auction)
          const auctionInfo: AuctionInfo = JSON.parse(stringify(await this.api.query.auctions.auctionInfo(), 2)) 
          console.debug(`Start: ${auctionInfo[0]}, Ending block: ${auctionInfo[1]}`)
          this.api.query.system.events((events: Vec<EventRecord>) => {
            console.debug(`Processing ${events.length} events`)
            // Loop through the Vec<EventRecord>
            events.forEach(async (record) => {
              // Extract the phase, event and the event types
              const { event, phase } = record;
              const types = event.typeDef;
              if (event.section == "auctions" || event.section == "crowdloan") {
              console.log(`\t${event.section}:${event.method}:: (phase=${phase.toString()})`);
              console.log(`\t\t${event.meta.docs.toString()}`);
        
              // Loop through each of the parameters, displaying the type and data
              event.data.forEach((data, index) => {
                console.log(`\t\t\t${types[index].type}: ${data.toString()}`);
              })
              }
              if (event.method == "Contributed") {
                const account = event.data[1].toString()
                const total = await this.api?.query.crowdloan.funds(account)
                if (total) {
                  const loan = <IJSonCrowdLoan><unknown>total.toHuman()
                  const raise = loan.raised.replaceAll(",","")
                  const parsedRaise = BigInt(raise)/BigInt(this.POLKADOT_NETWORK_VALUE)
                  console.debug(parsedRaise)
                  this.slackPublisher.publish(EventType.CROWDLOAN, account, parsedRaise.toString())
                  if (this.currentBidUpdated(parsedRaise)) {
                    await this.createBidTx(auctionCount.toString(), auctionInfo, parsedRaise)
                  }
                }
              }
              if (event.method == "BidAccepted") {
                const slot =  event.data[1].toString()
                const bid = event.data[2].toString()
                const number = BigInt(bid)/BigInt(this.POLKADOT_NETWORK_VALUE)
                console.info(`BID: ${number.toString()}, slot: ${slot}`)
                this.slackPublisher.publish(EventType.BID, slot, number.toString())
                this.currentBid = number
                if (number < this.MAX_BID && parseInt(slot) != this.SLOT) {
                  await this.createBidTx(auctionCount.toString(), auctionInfo, number)
                }
              }
            });
          });

          this.api.on('disconnected', async () => await this.start());
          this.api.on('error', async () => await this.start());
        } catch (e) {
          return this.start()
        }
    }

    private async createBidTx(auctionCount: String, auctionInfo: AuctionInfo, latestBid: bigint) {
      const newBid: bigint = latestBid + BigInt(this.BID_STEP)
      const amount: bigint = newBid >= this.MAX_BID ? this.MAX_BID : newBid
      console.info(`Placing bid of: ${amount}`)
      const finalAmount: bigint = amount.valueOf() * BigInt(this.POLKADOT_NETWORK_VALUE);
      const bidTx = this.api?.tx.auctions.bid(
          this.SLOT,
          parseInt(auctionCount.toString()),
          auctionInfo[0],
          auctionInfo[0] + 7,
          finalAmount
      )
      let signer = this.signer
      const signed = await  bidTx?.signAsync(this.signer.localAddress, { signer })
      signed?.send()
    }

    private currentBidUpdated(newLoan: bigint): boolean {
      if (newLoan > this.currentBid) {
        this.currentBid = newLoan
        return true
      }
      return false
    }
}

type AuctionInfo = [int, int]

interface IJSonCrowdLoan {
  depositor: string,
  verifier: string,
  deposit: string,
  raised: string,
  end: string,
  cap: string,
  lastContribution: { PreEnding: string },
  firstPeriod: string,
  lastPeriod: string,
  fundIndex: string
}
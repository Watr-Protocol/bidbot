import { Keyring } from "@polkadot/api";
import { Signer, SignerPayloadRaw, SignerResult } from "@polkadot/types/types";
import { hexToU8a, u8aToHex } from "@polkadot/util";
import { blake2AsHex, cryptoWaitReady } from '@polkadot/util-crypto';
import { AWSError } from "aws-sdk";
import SecretsManager, { GetSecretValueResponse } from "aws-sdk/clients/secretsmanager";

export default class TransactionSigner implements Signer {
    private local: boolean
    private localKeystore?: Keyring
    public localAddress: string = ""

    constructor(local: boolean, secret?: string) {
        this.local = local
        const client = new SecretsManager({region: "eu-west-2"})
        const keyPath = process.env.KEY_PATH ?? "test/address"
        if (local) {
            cryptoWaitReady().then(_ => {
                this.localKeystore = new Keyring({ type: 'sr25519' });
                this.localKeystore.setSS58Format(0);
                if (!secret) {
                    client.getSecretValue({SecretId: keyPath}, (err?: AWSError, data?: GetSecretValueResponse) => {
                        if (err) {
                            console.error(`Unable to load secret from AWS: ${err}`)
                            throw(err)
                        } else {
                            console.log(`Loaded secret data from ${data?.Name}`)
                            const secret: ISecret = JSON.parse(data!.SecretString!)
                            this.localAddress = this.localKeystore!.addFromMnemonic(secret!.value!).address;
                        }
                        console.debug(`Address: ${this.localAddress}`)
                    })
                }
            })
        }
    }

    async signRaw({ data }: SignerPayloadRaw): Promise<SignerResult> {
        return new Promise((resolve): void => {
            const hashed = (data.length > (256 + 1) * 2)
            ? blake2AsHex(data)
            : data;

            if (this.local) {
                const key = this.localKeystore!.getPair(this.localAddress!)
                const rawSignature = key.sign(hexToU8a(hashed), { withType: true })
                const signature = u8aToHex(rawSignature)
                resolve({id: 1, signature});
            }
        })
    }
}

interface ISecret {
    value: string
}
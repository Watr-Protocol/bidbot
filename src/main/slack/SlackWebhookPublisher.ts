import { EventType } from "../events/EventType"
import https from "https"

export default class SlackWebhookPublisher {
    private webhookUrl: string | undefined
    constructor() {
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL
    }
    async publish(eventType: EventType, paraID: String, amount: String) {
        if (this.webhookUrl != undefined) {
            const request = https.request(this.webhookUrl, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                  }
            }, (res) => {
                let data = '';
    
                res.on('data', (chunk) => {
                  data += chunk;
                });
              
                res.on('close', () => {
                  console.info('Retrieved all data');
                  console.info(data);
                });
              });
    
            const payload = new SlackPayload(eventType, paraID, amount)
            request.write(JSON.stringify(payload))
            request.on("error", (err) => {
                console.error(err.message)
            })
        }
    }
}

class SlackPayload {
    text: string

    constructor(eventType: EventType, paraID: String, amount: String) {
        switch (eventType as EventType) {
            case EventType.BID: {
                this.text = `New bid accepted, parachain ID: ${paraID}, amount: ${amount} DOT`
            }
            case EventType.CROWDLOAN: {
                this.text = `New crowdloan contribution, parachain ID: ${paraID}, total reserved: ${amount} DOT`
            }
        }
    }
}

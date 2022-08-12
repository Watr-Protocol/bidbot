import EventService from "./events/EventService"
import EventServiceImpl from "./events/EventServiceImpl"

main().then(
    _ => console.log("Listening")
).catch(
    e => console.error(e)
)

function main(): Promise<void> {
    console.info("Started application")
    const eventService: EventService = new EventServiceImpl()
    return eventService.start()
}
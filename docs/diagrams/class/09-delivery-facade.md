# Class · Delivery facade (email)

> Index: [10 · Infrastructure §11](../../10-infrastructure.md#11-delivery-facade) · Decisions: [ADR-021](../../11-decisions.md#adr-021), [ADR-025](../../11-decisions.md#adr-025) · Consumer: `tb.email` in [RabbitMQ topology](../architecture/09-rabbitmq-topology.md)

```mermaid
classDiagram
  direction LR
  class DeliveryFacade {
    <<Facade>>
    -EmailDriver email
    -TemplateRenderer renderer
    +sendEmail(message) DeliveryReceipt
  }
  class EmailDriver {
    <<interface>>
    +String name
    +send(renderedEmail) DeliveryReceipt
  }
  class TemplateRenderer {
    <<interface>>
    +render(template, locale, data) RenderedContent
  }
  class OutboundMessage {
    <<ValueObject>>
    +String to
    +String template
    +String locale
    +Object data
  }
  class DeliveryReceipt {
    <<ValueObject>>
    +String driver
    +String providerMessageId
  }
  class DeliveryError {
    +boolean retryable
    +String code
  }
  class SmtpEmailDriver {
    <<adapter>>
    -SmtpTransport transport
  }
  class SesEmailDriver {
    <<adapter>>
    -SesClient client
  }
  class MemoryEmailDriver {
    <<adapter>>
    -List~RenderedEmail~ sent
  }
  class DeliveryDriverFactory {
    +createEmail(config) EmailDriver
  }

  DeliveryFacade o-- EmailDriver
  DeliveryFacade o-- TemplateRenderer
  DeliveryFacade ..> OutboundMessage
  DeliveryFacade ..> DeliveryReceipt
  DeliveryFacade ..> DeliveryError : throws
  SmtpEmailDriver ..|> EmailDriver
  SesEmailDriver ..|> EmailDriver
  MemoryEmailDriver ..|> EmailDriver
  DeliveryDriverFactory ..> EmailDriver : EMAIL_DRIVER
```

## Pattern roles

- **Facade:** `DeliveryFacade` is the only sending API that application code sees. It renders the template in the recipient's locale, then hands the result to a driver.
- **Adapter / Strategy:** each driver wraps one provider. `DeliveryDriverFactory` picks one from `EMAIL_DRIVER`.
- **Worker only.** The API never sends anything itself. It raises events, and the worker's consumers call the facade.
- `DeliveryError.retryable` decides whether a consumer takes the retry ladder or goes to the DLQ ([State 16](../state/16-message-consumption.md)).

Driver status: [10 · Infrastructure §11](../../10-infrastructure.md#11-delivery-facade).

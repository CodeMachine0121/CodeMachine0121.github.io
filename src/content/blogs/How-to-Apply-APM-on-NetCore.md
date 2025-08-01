---
title: How to Apply APM on .NetCore
datetime: "2025-02-03 16:54:22"
---
## How to apply APM to .NetCore

> Some referred from FeloSearch

Certainly! Setting up Elastic APM with your .NET application involves several steps, which I’ll outline in detail below. We will cover installation, configuration, and deployment, ensuring you’ll be able to monitor your .NET application effectively.

### 1. Prerequisites

- **Elastic Stack:** Ensure you have an Elastic Stack (Elasticsearch, Kibana, and APM Server) set up. You can do this locally, but it is often deployed as part of an Elastic Cloud setup.
- **.NET SDK:** Ensure you have the .NET SDK installed.
- **NuGet Package Manager:** This is needed for installing necessary dependencies.
<!--more-->
### 2. Setup Apm Test Environment (You might change newest version by your own)

```yaml
version: '3.9'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.13.2
    environment:
      - discovery.type=single-node
    ports:
      - 9200:9200

  kibana:
    image: docker.elastic.co/kibana/kibana:7.13.2
    ports:
      - 5601:5601
    depends_on:
      - elasticsearch

  apm_server:
    image: docker.elastic.co/apm/apm-server:7.13.2
    ports:
      - 8200:8200
    environment:
      - output.elasticsearch.hosts=["elasticsearch:9200"]
    depends_on:
      - elasticsearch
```

### 3. Apply on .Net Core

1. **Install the Elastic APM NuGet Package:**
   From the Package Manager Console, run the following command:

   ```sh
   Install-Package Elastic.Apm.NetCoreAll
   ```

2. **Configure the APM Agent in your `Startup.cs`:**
   Add `UseElasticApm` to your application’s middleware pipeline.

   **Example:**

   ```csharp
   public class Startup
   {
       private readonly IConfiguration _configuration;

       public Startup(IConfiguration configuration)
       {
           _configuration = configuration;
       }

       public void ConfigureServices(IServiceCollection services)
       {
           services.AddControllersWithViews();
           // additional services configuration
       }

       public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
       {
           app.UseElasticApm(_configuration);
           app.UseStaticFiles();
           app.UseRouting();
           app.UseEndpoints(endpoints =>
           {
               endpoints.MapControllers();
           });
       }
   }
   ```

3. **Set up Configuration:**
   You’ll need to add your Elastic APM configuration settings. This can be done in `appsettings.json`:

   ```json
   {
     "ElasticApm": {
       "ServerUrls": "http://localhost:8200",
       "SecretToken": "YOUR_SECRET_TOKEN",
       "ServiceName": "YourApplicationName",
       "Environment": "production"
     }
   }
   ```

4. Monitor Application Performance via Kibana

   1. **Access Kibana APM Dashboard:**
      Open Kibana and navigate to the APM section. This is typically found under "Observability" or can be accessed directly by the APM application.

   2. **View Application Metrics:**
      You’ll be able to see various performance metrics, including transactions, errors, and traces. These visualizations help identify bottlenecks, performance issues, and the overall health of your application.

5. Check tracing in dashboard

![image.png](/src/content/images/tracing-without-span.png)

### 4. How to Trace Specific Methods

1. Set span in current transaction

```csharp

[Route("api/[controller]")]
public class TracingController : ControllerBase
{
    [HttpGet("custom")]
    public string CustomTracing()
    {
        Thread.Sleep(200);
        var transaction = Agent.Tracer.CurrentTransaction;
        
        var tracingService = new TracingService();
        
        tracingService.Trace();
        
        transaction.End();
        return "OK";
    }
}

public class TracingService
{
    public void Trace()
    {
        var startSpan = Agent.Tracer.CurrentTransaction.StartSpan("TraceService", "service");
        startSpan.SetLabel("customLabel", "customValue");
        Thread.Sleep(500);
        var traceRepository = new TraceRepository();
        traceRepository.Trace();
        startSpan.End();
    }
}

public class TraceRepository
{
    public void Trace()
    {
        var startSpan = Agent.Tracer.CurrentTransaction.StartSpan("TraceRepository", "repository");
        Thread.Sleep(700);
        startSpan.End();
    }
}
```

2. Check tracing in dashboard

![image.png](/src/content/images/tracing-with-span.png)

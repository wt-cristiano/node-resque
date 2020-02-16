#!/usr/bin/env ts-node

import { Plugin, Worker, Queue } from "./../src/index";
// In your projects: import { Worker, Scheduler, Queue } from "node-resque";

// ////////////////////////
// SET UP THE CONNECTION //
// ////////////////////////

const connectionDetails = {
  pkg: "ioredis",
  host: "127.0.0.1",
  password: null,
  port: 6379,
  database: 0
  // namespace: 'resque',
  // looping: true,
  // options: {password: 'abc'},
};

// ////////////////////
// BUILD THE PLUGIN //
// ////////////////////

class MyPlugin extends Plugin {
  constructor(...args) {
    // @ts-ignore
    super(...args);
    this.name = "MyPlugin";
  }

  beforePerform() {
    console.log(this.options.messagePrefix + " | " + JSON.stringify(this.args));
    return true;
  }

  beforeEnqueue() {
    return true;
  }
  afterEnqueue() {
    return true;
  }
  afterPerform() {
    return true;
  }
}

async function boot() {
  // ///////////////////////////
  // DEFINE YOUR WORKER TASKS //
  // ///////////////////////////

  let jobsToComplete = 0;

  const jobs = {
    jobby: {
      plugins: [MyPlugin],
      pluginOptions: {
        MyPlugin: { messagePrefix: "[🤡🤡🤡]" }
      },
      perform: (a, b) => {
        jobsToComplete--;
        tryShutdown();
      }
    }
  };

  // just a helper for this demo
  async function tryShutdown() {
    if (jobsToComplete === 0) {
      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });
      await worker.end();
      process.exit();
    }
  }

  // /////////////////
  // START A WORKER //
  // /////////////////

  const worker = new Worker(
    { connection: connectionDetails, queues: ["default"] },
    jobs
  );
  await worker.connect();
  worker.start();

  // //////////////////////
  // REGESTER FOR EVENTS //
  // //////////////////////

  worker.on("start", () => {
    console.log("worker started");
  });
  worker.on("end", () => {
    console.log("worker ended");
  });
  worker.on("cleaning_worker", (worker, pid) => {
    console.log(`cleaning old worker ${worker}`);
  });
  worker.on("poll", queue => {
    console.log(`worker polling ${queue}`);
  });
  worker.on("job", (queue, job) => {
    console.log(`working job ${queue} ${JSON.stringify(job)}`);
  });
  worker.on("reEnqueue", (queue, job, plugin) => {
    console.log(`reEnqueue job (${plugin}) ${queue} ${JSON.stringify(job)}`);
  });
  worker.on("success", (queue, job, result) => {
    console.log(`job success ${queue} ${JSON.stringify(job)} >> ${result}`);
  });
  worker.on("failure", (queue, job, failure) => {
    console.log(`job failure ${queue} ${JSON.stringify(job)} >> ${failure}`);
  });
  worker.on("error", (error, queue, job) => {
    console.log(`error ${queue} ${JSON.stringify(job)}  >> ${error}`);
  });
  worker.on("pause", () => {
    console.log("worker paused");
  });

  // /////////////////////
  // CONNECT TO A QUEUE //
  // /////////////////////

  const queue = new Queue({ connection: connectionDetails }, jobs);
  queue.on("error", function(error) {
    console.log(error);
  });
  await queue.connect();
  await queue.enqueue("default", "jobby", [1, 2]);
  jobsToComplete = 1;
}

boot();

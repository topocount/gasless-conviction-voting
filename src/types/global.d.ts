import fetch from "node-fetch";
declare namespace NodeJS {
  interface Global {
    fetch: fetch;
  }
}

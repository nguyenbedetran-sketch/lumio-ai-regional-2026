"use strict";
const assert = require("node:assert/strict"), errorInfo = require("../scripts/database-errors.cjs");
const remote = (message,code) => ({code:"",message:`Hrana(StreamError(Error { message: ${JSON.stringify(message)}, code: ${JSON.stringify(code)} }))`});
const secret = "synthetic-secret-must-not-escape", uncertain = {kind:"transport"};
assert.deepEqual(errorInfo({code:"SQLITE_CONSTRAINT_FOREIGNKEY",message:secret}),{kind:"sql",code:"SQLITE_CONSTRAINT_FOREIGNKEY"});
assert.deepEqual(errorInfo(remote("FOREIGN KEY constraint failed","SQLITE_CONSTRAINT_FOREIGNKEY")),{kind:"sql",code:"SQLITE_CONSTRAINT_FOREIGNKEY"});
assert.deepEqual(errorInfo(remote("AUDIT_APPEND_ONLY","SQLITE_CONSTRAINT_TRIGGER")),{kind:"sql",code:"SQLITE_CONSTRAINT_TRIGGER",guard:"AUDIT_APPEND_ONLY"});
assert.deepEqual(errorInfo(remote("database is locked","SQLITE_BUSY")),{kind:"sql",code:"SQLITE_BUSY"});
for (const input of [
  {code:"SQLITE_ERROR",message:"SQLITE_CONSTRAINT_FOREIGNKEY"},
  remote(secret,"SQLITE_ERROR"), remote(secret,"SQLITE_IOERR"), remote(secret,"SQLITE_AUTH"),
  {code:"",message:"network timeout SQLITE_CONSTRAINT_FOREIGNKEY AUDIT_APPEND_ONLY"},
  {code:"",message:"prefix "+remote(secret,"SQLITE_CONSTRAINT").message},
  {code:"",message:remote(secret,"SQLITE_CONSTRAINT").message+" suffix"},
  {code:"NETWORK_ERROR",message:remote(secret,"SQLITE_CONSTRAINT").message},
  {code:"",message:'Hrana(StreamError(Error { message: "bad\\q", code: "SQLITE_BUSY" }))'},
  {code:"",message:remote('code: "SQLITE_CONSTRAINT_TRIGGER"',"TIMEOUT").message},
]) assert.deepEqual(errorInfo(input),uncertain);
assert.ok(!JSON.stringify(errorInfo(remote(secret,"SQLITE_CONSTRAINT_UNIQUE"))).includes(secret));
console.log("PASS Pinned Hrana structured SQL failures remain definite; transport/unknown/malformed errors remain uncertain (15 assertions)");

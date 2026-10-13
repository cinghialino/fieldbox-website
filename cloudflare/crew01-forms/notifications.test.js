import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { flushNotifications } from "./notifications.js";
function fixture(t, send) {
 const db = new DatabaseSync(":memory:"); t.after(() => db.close());
 for (const file of ["0001_testflight.sql", "0002_testflight_notifications.sql"]) db.exec(readFileSync(new URL(`./migrations/${file}`, import.meta.url), "utf8"));
 db.prepare("INSERT INTO testflight_applications (id,campaign,email,name,device,setup,workflow,consent_version,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("sample-record", "beta", "tester@example.com", "Test Élodie", "iPad", "Camera and SSD", "", "test", new Date().toISOString());
 const binding={prepare:sql=>({bind:(...args)=>({all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>{db.prepare(sql).run(...args);return {success:true};}})})};
 return {db, env:{TESTFLIGHT_DB:binding, TESTFLIGHT_NOTIFY_TO:"owner@example.com", TESTFLIGHT_EMAIL:{send}}};
}
const makeEmail=async(from,to,raw)=>({from,to,raw});
test("saved applications email the owner with complete UTF-8 details, then leave the queue",async t=>{
 const messages=[];const {db,env}=fixture(t,async message=>messages.push(message));
 await flushNotifications(env,makeEmail);await flushNotifications(env,makeEmail);
 assert.equal(messages.length,1);assert.equal(messages[0].to,"owner@example.com");
 const text=Buffer.from(messages[0].raw.split("\r\n\r\n")[1].replace(/\r\n/g,""),"base64").toString("utf8");
 assert.match(text,/Test Élodie/);assert.match(text,/tester@example.com/);assert.match(text,/left blank/);assert.match(text,/sample-record/);
 assert.ok(db.prepare("SELECT notification_sent_at FROM testflight_applications").get().notification_sent_at);
});
test("failed emails retain the application and retry later",async t=>{
 let fail=true;const {db,env}=fixture(t,async()=>{if(fail) throw new Error("unavailable");});
 await flushNotifications(env,makeEmail);
 let row=db.prepare("SELECT * FROM testflight_applications").get();
 assert.equal(row.notification_sent_at,null);assert.equal(row.notification_attempts,1);assert.ok(row.notification_next_attempt>new Date().toISOString());assert.equal(row.status,"applied");
 fail=false;db.exec("UPDATE testflight_applications SET notification_next_attempt = ''");await flushNotifications(env,makeEmail);
 row=db.prepare("SELECT * FROM testflight_applications").get();assert.ok(row.notification_sent_at);assert.equal(row.notification_attempts,2);
});

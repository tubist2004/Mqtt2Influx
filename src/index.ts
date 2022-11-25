"use strict";
import { FieldType, InfluxDB, IPoint } from "influx";
import * as mqtt from "mqtt";
import { renderString } from "nunjucks";

let MQTT_SERVER = "tubist2004.mooo.com";
let MQTT_USER = "homeautomation";
let MQTT_PASSWORD = "homeautomation";
let HA_DISCOVERY_TOPIC = "homeassistant/+/+/config";

const client = mqtt.connect({
  hostname: MQTT_SERVER,
  username: MQTT_USER,
  password: MQTT_PASSWORD,
});

function onConnect(stream: any) {
  console.log("connected to " + MQTT_SERVER);
  client.subscribe(HA_DISCOVERY_TOPIC, () => {
    console.log("Subscribed to " + HA_DISCOVERY_TOPIC);
  });
}

interface HaConfigMessage {
  name: string;
  state_topic: string;
  value_template: string;
  unique_id: string;
  expire_after?: number;
  device: {
    identifiers: string;
    name: string;
    manufacturer: string;
    model: string;
  };
}

interface Entry {
  cb: (e: Entry, data: string) => IPoint | null;
  data: any;
}

let msgMap: Map<string, Entry[]> = new Map();

function onHaState(e: Entry, msg: string): IPoint | null {
  let confMsg = e.data as HaConfigMessage;
  let value_json = JSON.parse(msg);
  let obj = { value_json: value_json };
  let value = renderString(confMsg.value_template, obj);
  let fields: any = {};
  fields[confMsg.name] = Number.parseFloat(value);
  if (!Number.isFinite(fields[confMsg.name])) {
    return null;
  }
  return {
    tags: {
      name: confMsg.name,
      uniqueId: confMsg.unique_id,
      device: confMsg.device.identifiers,
      deviceManufacturer: confMsg.device.manufacturer,
      deviceModel: confMsg.device.model,
      deviceName: confMsg.device.name,
    },
    fields: fields,
  };
}

let fieldType: any = {};
function onHaDiscovery(topic: string, confMsg: HaConfigMessage) {
  let es: Entry[];
  if (msgMap.has(confMsg.state_topic)) {
    es = <Entry[]>msgMap.get(confMsg.state_topic);
  } else {
    es = [];
    msgMap.set(confMsg.state_topic, es);
    client.subscribe(confMsg.state_topic);
  }
  let e: Entry = {
    cb: onHaState,
    data: confMsg,
  };
  if (
    es.find((element) => {
      let eq = JSON.stringify(element.data) == JSON.stringify(e.data);
      return eq;
    }) == undefined
  ) {
    es.push(e);
    fieldType[confMsg.name] = FieldType.FLOAT;
    let schema = {
      measurement: "mqtt",
      tags: [
        "name",
        "uniqueId",
        "device",
        "deviceManufacturer",
        "deviceModel",
        "deviceName",
      ],
      fields: fieldType,
    };
    //db.addSchema(schema);
  }
}

const sub2regex = (topic: string) => {
  return new RegExp(
    `^${topic}\$`.replaceAll("+", "[^/]*").replace("/#", "(|/.*)")
  );
};

client.on("connect", onConnect);
client.on("message", (topic, payload, packet) => {
  if (sub2regex(HA_DISCOVERY_TOPIC).test(topic)) {
    onHaDiscovery(topic, JSON.parse(payload.toString()));
  } else if (msgMap.has(topic)) {
    let fields = (msgMap.get(topic) as Entry[]).map((e) => {
      return e.cb(e, payload.toString());
    }).filter(el => el != null) as IPoint[];
    //console.log(topic, fields.length);
    db.writeMeasurement(topic, fields);
  }
});

const db = new InfluxDB({
  host: "tubist2004.mooo.com",
  database: "telegraf",
  username: "telegraf",
});

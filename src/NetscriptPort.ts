import { Settings } from "./Settings/Settings";
import { NetscriptPort } from "@nsdefs";
import { NetscriptPorts } from "./NetscriptWorker";
import { PositiveInteger } from "./types";

type PortData = string | number;
type Resolver = () => void;
const emptyPortData = "NULL PORT DATA";
/** The object property is for typechecking and is not present at runtime */
export type PortNumber = PositiveInteger & { __PortNumber: true };

/** Gets the numbered port, initializing it if it doesn't already exist.
 * Only using for functions that write data/resolvers. Use NetscriptPorts.get(n) for */
export function getPort(n: PortNumber) {
  let port = NetscriptPorts.get(n);
  if (port) return port;
  port = new Port();
  NetscriptPorts.set(n, port);
  return port;
}

export class Port {
  data: PortData[] = [];
  resolver: Resolver | null = null;
  promise: Promise<void> | null = null;
  resolve() {
    if (!this.resolver) return;
    this.resolver();
    this.resolver = null;
    this.promise = null;
  }
}
export function portHandle(n: PortNumber): NetscriptPort {
  return {
    write: (value: unknown) => writePort(n, value),
    tryWrite: (value: unknown) => tryWritePort(n, value),
    read: () => readPort(n),
    peek: () => peekPort(n),
    nextWrite: () => nextWritePort(n),
    full: () => isFullPort(n),
    empty: () => isEmptyPort(n),
    clear: () => clearPort(n),
  };
}

export function writePort(n: PortNumber, value: unknown): PortData | null {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(
      `port.write: Tried to write type ${typeof value}. Only string and number types may be written to ports.`,
    );
  }
  const { data, resolve } = getPort(n);
  data.push(value);
  resolve();
  if (data.length > Settings.MaxPortCapacity) return data.shift() as PortData;
  return null;
}

export function tryWritePort(n: PortNumber, value: unknown): boolean {
  if (typeof value != "number" && typeof value != "string") {
    throw new Error(
      `port.write: Tried to write type ${typeof value}. Only string and number types may be written to ports.`,
    );
  }
  const { data, resolve } = getPort(n);
  if (data.length >= Settings.MaxPortCapacity) return false;
  data.push(value);
  resolve();
  return true;
}

export function readPort(n: PortNumber): PortData {
  const port = NetscriptPorts.get(n);
  if (!port || !port.data.length) return emptyPortData;
  const returnVal = port.data.shift() as PortData;
  if (!port.data.length && !port.resolver) NetscriptPorts.delete(n);
  return returnVal;
}

export function peekPort(n: PortNumber): PortData {
  const port = NetscriptPorts.get(n);
  if (!port || !port.data.length) return emptyPortData;
  return port.data[0];
}

function nextWritePort(n: PortNumber) {
  const port = getPort(n);
  if (port.promise) return port.promise;
  port.promise = new Promise<void>((res) => (port.resolver = res));
  return port.promise;
}

function isFullPort(n: PortNumber) {
  const port = NetscriptPorts.get(n);
  if (!port) return false;
  return port.data.length >= Settings.MaxPortCapacity;
}

function isEmptyPort(n: PortNumber) {
  const port = NetscriptPorts.get(n);
  if (!port) return true;
  return port.data.length === 0;
}

export function clearPort(n: PortNumber) {
  const port = NetscriptPorts.get(n);
  if (!port) return;
  if (!port.resolver) NetscriptPorts.delete(n);
  port.data.length = 0;
}

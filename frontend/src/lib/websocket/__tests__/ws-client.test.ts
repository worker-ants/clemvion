import { describe, it, expect, beforeEach, vi } from "vitest";

function createMockSocket() {
  return {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
}

let mockSocket = createMockSocket();

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

import { createWsClient, getWsClient, resetWsClient } from "../ws-client";
import { io } from "socket.io-client";

const mockIo = vi.mocked(io);

describe("ws-client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSocket = createMockSocket();
    mockIo.mockReturnValue(mockSocket as never);
    resetWsClient();
  });

  describe("createWsClient", () => {
    it("creates a client with all required methods", () => {
      const client = createWsClient();
      expect(client.connect).toBeDefined();
      expect(client.disconnect).toBeDefined();
      expect(client.subscribe).toBeDefined();
      expect(client.unsubscribe).toBeDefined();
      expect(client.on).toBeDefined();
      expect(client.off).toBeDefined();
      expect(client.isConnected).toBeDefined();
      expect(client.getSocket).toBeDefined();
      expect(client.waitForConnect).toBeDefined();
    });

    it("returns not connected initially", () => {
      const client = createWsClient();
      expect(client.isConnected()).toBe(false);
    });

    it("returns null socket initially", () => {
      const client = createWsClient();
      expect(client.getSocket()).toBeNull();
    });

    it("creates socket on connect with auth only (no query token)", () => {
      const client = createWsClient();
      client.connect("test-token");
      expect(mockIo).toHaveBeenCalledWith(
        expect.stringContaining("/ws"),
        expect.objectContaining({
          auth: { token: "test-token" },
        }),
      );
      // Verify token is NOT in query params (security)
      const callArgs = mockIo.mock.calls[0][1] as Record<string, unknown>;
      expect(callArgs.query).toBeUndefined();
    });

    it("skips connect if already connected", () => {
      const client = createWsClient();
      client.connect("token1");
      mockSocket.connected = true;
      client.connect("token2");
      expect(mockIo).toHaveBeenCalledTimes(1);
    });

    it("reconnects with new token if socket exists but disconnected", () => {
      const client = createWsClient();
      client.connect("token1");
      mockSocket.connected = false;
      client.connect("token2");
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(mockIo).toHaveBeenCalledTimes(2);
    });

    it("subscribes to a channel", () => {
      const client = createWsClient();
      client.connect("token");
      client.subscribe("execution:abc");
      expect(mockSocket.emit).toHaveBeenCalledWith("subscribe", {
        channel: "execution:abc",
      });
    });

    it("unsubscribes from a channel", () => {
      const client = createWsClient();
      client.connect("token");
      client.unsubscribe("execution:abc");
      expect(mockSocket.emit).toHaveBeenCalledWith("unsubscribe", {
        channel: "execution:abc",
      });
    });

    it("disconnects and clears socket", () => {
      const client = createWsClient();
      client.connect("token");
      client.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(client.getSocket()).toBeNull();
    });
  });

  describe("waitForConnect", () => {
    it("resolves immediately if already connected", async () => {
      const client = createWsClient();
      client.connect("token");
      mockSocket.connected = true;
      await expect(client.waitForConnect()).resolves.toBeUndefined();
    });

    it("rejects if socket not initialized", async () => {
      const client = createWsClient();
      await expect(client.waitForConnect()).rejects.toThrow(
        "Socket not initialized",
      );
    });

    it("waits for connect event if not yet connected", async () => {
      const client = createWsClient();
      client.connect("token");
      mockSocket.connected = false;

      mockSocket.once.mockImplementation(
        (event: string, callback: (...args: unknown[]) => void) => {
          if (event === "connect") {
            setTimeout(() => callback(), 5);
          }
        },
      );

      await expect(client.waitForConnect()).resolves.toBeUndefined();
    });

    it("rejects on connect_error", async () => {
      const client = createWsClient();
      client.connect("token");
      mockSocket.connected = false;

      mockSocket.once.mockImplementation(
        (event: string, callback: (...args: unknown[]) => void) => {
          if (event === "connect_error") {
            setTimeout(() => callback(new Error("Auth failed")), 5);
          }
        },
      );

      await expect(client.waitForConnect()).rejects.toThrow("Auth failed");
    });
  });

  describe("getWsClient (singleton)", () => {
    it("returns the same instance on multiple calls", () => {
      const client1 = getWsClient();
      const client2 = getWsClient();
      expect(client1).toBe(client2);
    });

    it("returns a new instance after reset", () => {
      const client1 = getWsClient();
      resetWsClient();
      const client2 = getWsClient();
      expect(client1).not.toBe(client2);
    });

    it("disconnects on reset", () => {
      const client = getWsClient();
      client.connect("token");
      resetWsClient();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });
});

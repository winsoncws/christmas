import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Router } from "@vaadin/router";
import { provide } from "@lit/context";
import { Wallet } from "@solana/wallet-adapter-react";
import { createContext } from "@lit/context";
import { AnchorClient } from "../lib/anchor/anchorClient";
import { ClientDevice, getClientDevice } from "../lib/utils";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { NFT_STORAGE_TOKEN } from "../lib/constants";

// Providers
export const walletContext = createContext<Wallet | null>(Symbol("wallet"));
export const anchorClientContext = createContext<AnchorClient | null>(
  Symbol("anchor-client")
);
export const clientDeviceContext = createContext<ClientDevice | null>(
  Symbol("client-device")
);
export const nftStorageClientContext = createContext<NFTStorageClient | null>(
  Symbol("nft-storage")
);

// App Main
@customElement("app-main")
export class AppMain extends LitElement {
  // Providers
  @provide({ context: walletContext })
  @state()
  accessor wallet = null;

  @provide({ context: anchorClientContext })
  @state()
  accessor anchorClient: AnchorClient | null = null;

  @provide({ context: clientDeviceContext })
  @state()
  accessor clientDevice: ClientDevice | null = null;

  @provide({ context: nftStorageClientContext })
  @state()
  accessor nftStorageClient: NFTStorageClient = new NFTStorageClient({
    token: NFT_STORAGE_TOKEN,
  });

  async connectedCallback() {
    super.connectedCallback();

    // Get client device information
    this.clientDevice = await getClientDevice();
  }

  // Setup router
  firstUpdated() {
    const router = new Router(this.shadowRoot?.querySelector("#page-route"));
    router.setRoutes([
      { path: "/mint", component: "mint-page" },
      { path: "/coupons", component: "coupons-page" },
      { path: "(.*)", component: "coupons-page" },
    ]);
  }

  onConnectWallet(e: CustomEvent) {
    this.wallet = e.detail.wallet;
    if (e.detail.wallet) {
      this.anchorClient = new AnchorClient({ wallet: e.detail.wallet.adapter });
      console.log(this.anchorClient);
    }
  }
  onDisconnectWallet(e: CustomEvent) {
    this.wallet = null;
    this.anchorClient = null;
  }

  getContent() {
    // TODO: the wallet is connected, but anchorClient is null, when refreshing the page, need to create anchorclient if there is a wallet on page refresh

    return html`
      <!-- Show page-route if there wallet is connected -->
      <div
        id="page-route"
        class=${classMap({ hidden: !Boolean(this.anchorClient) })}
      ></div>
      <!-- Show onboard-wallet-page if wallet is not connected -->
      <onboard-wallet-page
        class=${classMap({ hidden: Boolean(this.anchorClient) })}
      ></onboard-wallet-page>
    `;
  }

  static styles = css`
    .hidden {
      display: none;
    }
  `;

  render() {
    return html`
      <!-- Header -->
      <app-header-layout>
        <app-header slot="header">
          <app-toolbar>
            <div main-title>App name</div>
          </app-toolbar>
        </app-header>
      </app-header-layout>

      <!-- Content -->
      ${this.getContent()}

      <!-- Footer -->
      <app-footer>
        <a href="/coupons" slot="left"><sl-menu-item>Coupons</sl-menu-item></a>
        <a href="/mint" slot="right"><sl-menu-item>Mint</sl-menu-item></a>
      </app-footer>
    `;
  }
}
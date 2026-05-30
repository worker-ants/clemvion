// loader.js IIFE 진입점 — 번들되어 <script src=".../web-chat/v1/loader.js"> 로 로드.
// 전역 ClemvionChat dispatcher 를 설치하고 스니펫 큐를 replay. spec/7-channel-web-chat/2-sdk §1.
import { installGlobal } from "./loader";

installGlobal();

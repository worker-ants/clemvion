---
id: "CLE-CHAT"
title: "채팅 채널"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "fd05eff4fdbc4f1564fa41d2b7c788937939f44213762acb7b3d5472240a14ac"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/7-trigger/providers/*.md", "spec/5-system/15-chat-channel.md", "spec/conventions/chat-channel-adapter.md", "spec/data-flow/14-chat-channel.md"]
mirror_sha256: "0491b8186bc0e48df4f0f10cd45fa44ad8f6a5caf3ca86fb4c3771fce7472f49"
etag: "sha256-37239a1f240758ef52d26d26d8c0b41a7328a95cb32b7c728243aa0dedba58e4"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/*.md`, `spec/data-flow/14-chat-channel.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

채팅 채널(Chat Channel, `config.chatChannel`)은 Telegram·Slack·Discord 봇 위에서 워크플로우를 챗봇처럼 돌리는 서버 쪽 어댑터 계층이다. 사용자는 봇 토큰만 등록하고, 메신저 update 를 워크플로우 입력으로 바꾸는 일과 워크플로우 응답을 메신저 메시지로 바꾸는 일은 채널 어댑터가 맡는다.

[External Interaction API](../CLE-IX/CLE-EIA.md) 는 웹훅, EIA 알림 웹훅, REST·SSE 표면을 제공하지만 외부 메신저와 붙이려면 사용자가 변환 계층을 직접 운영해야 한다. 채팅 채널은 그 변환 계층을 서버 안에 두고 EIA 의 소비자로 격리한 편의 계층이다. 새 트리거 유형이 아니라 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 트리거의 설정 한 갈래로 동작한다. 웹채팅 위젯은 채팅 채널 모듈을 거치지 않는 EIA 의 외부 HTTP 소비자라 [웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md) 영역에서 다룬다.

v1 은 1:1 DM 만 지원하고, 시각형 노드(Chart·Table·Carousel)는 텍스트 표현으로 보낸다. 이미지 렌더(SSR PNG), Slack Socket Mode, Discord Gateway 는 v2 후속이다.

## 문서

- [채팅 채널](CLE-CHAT-CORE.md): 요구사항, 처리 흐름, 인증과 보안, 봇 토큰 재발급 API, PATCH 비밀 차단 정책, 인바운드 HTTP 응답 계약, EIA 와의 관계, 채널 프로바이더 카탈로그.
- [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md): 모든 채널 어댑터가 지키는 함수 시그니처와 데이터 타입, 이벤트별 렌더 매핑, 실행 실패 안내 분류, Form 입력 흐름(네이티브 모달과 다단계 질문).
- [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md): `Trigger.config.chatChannel` 필드와 안내 문구 기본값, 트리거 컬럼, Redis 채널 대화 상태와 키, 인바운드·아웃바운드 흐름, 봇 토큰 라이프사이클.
- [Telegram 어댑터](CLE-CHAT-TELEGRAM.md): Telegram Bot API 매핑, 명령, 노드 UI 매핑, 시각형 매트릭스의 기준.
- [Slack 어댑터](CLE-CHAT-SLACK.md): Slack Web API·Events API·Interactivity 매핑, `views.open` 모달, 서명 검증.
- [Discord 어댑터](CLE-CHAT-DISCORD.md): Discord REST·Interactions Webhook 매핑, slash command·Reply 모달, ed25519 검증.

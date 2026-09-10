# Rationale 연속성 검토 — spec-draft-telegram-signing-carveout

## 발견사항

- **[CRITICAL] 어제 커밋이 함께 묶었던 3중 미러 중 하나(`2-trigger-list.md:176`)가 변경안에서 빠졌다**
  - target 위치: `## 변경안` 표 (A~E) — `spec/2-navigation/2-trigger-list.md` 가 목록에 없음
  - 과거 결정 출처: `df1962e25`(#1311, 어제) 커밋 본문 자체가 "변경 (A~H)"에서 **세 파일을 하나의 단위로** 명시했다 — `15-chat-channel.md`(A/B/C/E/F/H), `2-navigation/2-trigger-list.md`(**D** — "두 필드 차단 + PATCH 가 비밀을 안 건드림 + ref 재유도"), `data-flow/14-chat-channel.md`(**G**). 즉 "`chatChannel` 이 실린 PATCH 는 bot token·inbound signing 값을 바꾸지 않는다"라는 **같은 문장**이 이 3파일에 의도적으로 동시 이식됐다.
  - 상세: 실측 결과 `spec/2-navigation/2-trigger-list.md:176`에 정확히 같은 블랭킷 문장이 남아 있다 — *"`chatChannel` 이 실린 PATCH 는 저장된 비밀을 바꾸지 않는다 — bot token·inbound signing 값은 요청 전후로 동일하고 … 상세 [Chat Channel R-CC-21](...)"*. target 의 변경안 A(15-chat-channel.md §5.4.1)·B(R-CC-21)·C(data-flow §1.3)를 적용하면 telegram 의 `issuedInboundSigning` 은 PATCH 마다 갱신된다고 두 파일이 말하게 되는데, `2-trigger-list.md:176`은 여전히 "값은 요청 전후로 동일하다"를 R-CC-21 인용과 함께 무조건 주장한다. 세 파일은 어제 커밋이 만든 **단일 SoT 삼중 미러**였고, 그중 하나만 좁히면 telegram 축에서 두 문서가 직접 모순한다.
  - 제안: 변경안에 **F(가칭)** 항목을 추가 — `2-trigger-list.md:176`의 "bot token·inbound signing 값은 요청 전후로 동일하고" 문구에도 A/B/C 와 동일한 telegram carve-out 캐비아트를 반영한다. (같은 줄이 `botTokenRef`/`inboundSigningPlaintext` PATCH 차단 설명도 겸하므로, 차단 서술은 그대로 두고 "값 불변" 서술만 좁히면 된다.)

- **[INFO] 신설 carve-out 에 "기각한 대안" 절이 비어 있다**
  - target 위치: `## 결정` D-A/D-B/D-C, `## 변경안` B (`R-CC-21` 갱신 + "carve-out 소절 신설")
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `### R-CC-21`(기각한 대안 2건), `### R-CC-10`(single-path 채택 근거에 대안 비교 포함) — 이 spec 라인의 기존 Rationale 항목들은 모두 "기각한 대안" 또는 이에 준하는 대안 비교 서술을 갖는 관례다.
  - 상세: target 의 D-A/D-B/D-C 는 "왜 telegram 을 가르는가"만 설명하고, 예컨대 "telegram 도 별도 rotate-inbound-signing API 로 분리한다" / "PATCH 트리거 setupChannel 재호출 시 새 secret_token 발급을 억제하고 기존 값 유지" 같은 대안을 검토·기각했다는 기록이 없다. R-CC-21 은 스스로 "리뷰가 처음 제시한 처방(필드만 제외)"이 실제로는 비밀을 파괴한다는 것을 대안 비교로 드러냈던 전례가 있다 — 같은 패턴(대안을 실측으로 반증)이 이번 telegram 축에도 이미 있다(§실측 표의 "두 갈래 다 문제다" 분석이 사실상 대안 비교다). 이를 정식 "기각한 대안" 절로 옮겨 적지 않으면 향후 재검토자가 "왜 telegram 만 계속 쓰게 뒀는가"를 처음부터 다시 추적해야 한다.
  - 제안: 변경안 B 의 carve-out 소절에 "기각한 대안" 소제목을 추가하고, target 문서의 §실측·§두 갈래 다 문제다 절 내용을 그 근거로 흡수한다 (이미 쓴 내용을 옮기는 수준이라 비용이 낮다).

- **[INFO] carve-out 의 문서 배치가 기존 axis-per-section 관례와 어긋날 수 있다**
  - target 위치: `## 변경안` A — `15-chat-channel.md §5.4.1`(제목 "Bot Token 변경 single-path 정책") 표 행에 telegram inbound-signing 캐비아트 추가
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1(botToken 전용) vs §5.4.1.1(제목 자체가 "`inboundSigning` PATCH 정책 (slack / discord 한정)") — 두 절은 **자원 축(botToken vs inboundSigning)별로 별도 절을 두는 구조**를 이미 확립했다.
  - 상세: telegram 의 `issuedInboundSigning` 은 botToken 축이 아니라 inboundSigning 축이다. 이를 §5.4.1(botToken 절) 표 행에 한 문장으로 끼워 넣으면, 기존에 "§5.4.1.1 은 slack/discord 한정"이라는 정확한 경계 제목과 나란히 봤을 때 "왜 telegram inbound-signing 얘기가 botToken 절에 있는가"가 헷갈릴 수 있다.
  - 제안: telegram carve-out 을 §5.4.1.1 을 확장하거나(제목을 "slack/discord 한정"에서 "slack/discord — v1 차단, telegram — 예외" 식으로 갱신) 별도 §5.4.1.2 로 병렬 배치하는 안을 검토. 필수는 아니고 가독성 제안.

## 요약

target 의 핵심 결정(telegram `issuedInboundSigning` 을 R-CC-21 의 "PATCH 는 비밀을 쓰지 않는다" 블랭킷 원칙에서 분리)은 **기각된 대안의 무단 재도입이나 시스템 invariant 우회가 아니다** — 실측(adapter 코드·서비스 코드·spec 세 층 교차)으로 문면이 거짓임을 확인했고, R-CC-21 을 직접 수정(변경안 B)하며 새 근거(D-A/D-B, 자원 성격 축)를 함께 제시하는 정상적인 Rationale 갱신 패턴을 따른다. 다만 어제 같은 커밋(`df1962e25`/#1311)이 **동일 문장을 3파일에 동시 이식**했다는 사실을 target 이 놓쳐, 변경안이 `15-chat-channel.md`·`data-flow/14-chat-channel.md` 두 곳만 좁히고 `2-navigation/2-trigger-list.md:176`을 그대로 두면 세 미러 중 하나가 새로 좁혀진 R-CC-21 과 직접 모순하는 상태로 남는다. 이 CRITICAL 은 target 자체의 판단 오류라기보다 **적용 범위 누락**이라 변경안에 한 항목만 추가하면 해소된다.

## 위험도
CRITICAL

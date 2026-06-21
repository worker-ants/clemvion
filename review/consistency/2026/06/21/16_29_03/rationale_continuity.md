# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/6-websocket-protocol.md`, diff-base=`origin/main`

---

### 발견사항

- **[INFO]** OCP 확장 방식의 정제 — 배열 직접 확장 → DI 역전 승격
  - target 위치: `websocket.gateway.ts` diff (생성자 변경), `websocket.module.ts` (CHANNEL_AUTHORIZER factory), 각 도메인 모듈 authorizer 파일 신설
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md § Rationale "§3.3 채널 인가 — `workflow:`·`notifications:` authorizer 추가 (refactor 04 M-6)"`, 그리고 `websocket.gateway.ts` 이전 구현의 인라인 `channelAuthorizers` 배열 주석 `(W-13: OCP 개선)`
  - 상세: 과거 M-6 Rationale 은 `channelAuthorizers` OCP 구조를 "`배열 항목 추가만으로 격리적으로 확장`"이라고 정의했다. 이번 M-7 구현은 그 정의보다 한 단계 더 나아가, 배열 직접 수정이 아닌 NestJS `CHANNEL_AUTHORIZER` multi-provider DI 역전으로 확장 방식을 바꾸었다. spec Rationale 이 "배열 추가"를 기각하고 "DI 역전"을 채택한 기록은 현재 spec 에 없다.
  - 제안: 변경 의도가 명확하고(실제로 OCP 를 한 단계 더 강화하는 정방향 개선이며, `websocket.module.ts` 의 factory 주석에 번경 근거가 인라인 설명됨), 기각된 대안 재도입에 해당하지 않으며 합의된 보안 invariant 도 침해하지 않는다. 다만 spec Rationale 에 M-7 결정("배열 직접 확장 대신 DI 역전 채택 이유 + 기각된 useFactory multi:true 안 + W-5 fail-closed 강화")을 명문화해 추후 독자가 M-6 Rationale 과의 관계를 파악할 수 있도록 갱신하면 완전해진다.

- **[INFO]** W-6 UUID 선차단 정책의 `kb:` 채널 적용 확대
  - target 위치: `kb-channel-authorizer.ts` (신규, `isValidUuid` 호출), `kb-channel-authorizer.spec.ts`
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §3.3` 표의 `kb:{documentId}` 행: "workspace 문서 소유 검증" (W-6 비-UUID 선차단 표기 없음). W-6 는 `background:run:`·`execution:`·`workflow:` 에만 명시됨.
  - 상세: 과거 인라인 gateway 구현은 `kb:` authorizer 에서 `isValidUuid` 선차단 없이 `verifyDocumentOwnership(documentId, workspaceId)` 를 바로 호출했다(Postgres 캐스팅 오류가 거부). 이번 구현은 `kb-channel-authorizer.ts` 주석에서 "동작 보존 — 비-UUID 는 양쪽 다 거부" 라고 설명하며 W-6 정책을 일관 적용했다. 기술적으로 행동 변화가 없으나(DB 에서 거부 → isValidUuid 에서 선차단), spec §3.3 표에는 `kb:` 채널의 비-UUID 선차단 표기가 빠져 있다.
  - 제안: 기능 동작은 동일하고 defensive improvement 이므로 blocking 사안이 아니다. spec §3.3 의 `kb:{documentId}` 행에 "(비-UUID 선차단)" 표기를 추가해 execution/workflow/background:run 과 일관되게 정렬하면 된다.

- **[INFO]** `CHANNEL_AUTHORIZER` 토큰 미발견 채널의 fail-closed 처리 신설 (W-5)
  - target 위치: `websocket.gateway.ts` diff — `if (!authorizer)` 분기 신설, 테스트 `"rejects a valid-prefix channel with no matching authorizer (fail-closed, W-5)"`
  - 과거 결정 출처: 이전 구현(`if (authorizer) { ... }` — `authorizer` 부재 시 묵시적 join 허용 패스). spec Rationale 에 이 상황(prefix 는 valid 이나 authorizer 부재)에 대한 명시 결정 기록 없음.
  - 상세: 이전 구현은 `channelAuthorizers.find()` 가 `undefined` 를 반환하면 인가 블록 자체를 건너뛰어 join 을 허용했다. 이번 변경은 `authorizer` 부재를 명시적 거부로 바꿨다(fail-closed). 이는 과거 설계의 잠재적 구멍을 봉인하는 보안 개선이므로 Rationale 연속성 위반이 아니고, OCP invariant("신규 채널 = 배열 확장"에서 "신규 채널 = DI provider 등록")와도 정합한다.
  - 제안: spec §3.3 에 "매칭 authorizer 없는 valid-prefix 채널은 기본 거부(fail-closed, W-5)" 규약을 한 줄 추가하면 spec 의 invariant 기록이 완성된다.

---

### 요약

이번 M-7 구현은 M-6 Rationale 이 합의한 OCP 설계 원칙("배열 항목 추가만으로 확장")을 위반하거나 기각된 대안을 재도입하지 않는다. 오히려 그 원칙을 NestJS DI 역전으로 한 단계 강화한 설계이며, 보안 invariant(IDOR 차단, W-6 UUID 선차단, fail-closed) 를 후퇴시키지 않고 일관하게 유지·확대 적용하고 있다. 검출된 세 항목은 모두 spec Rationale 에 새 결정 내용이 반영되지 않은 문서 갱신 누락(INFO 등급)이며, 기각된 대안 재도입이나 합의 원칙 위반(CRITICAL/WARNING)에 해당하는 항목은 없다.

---

### 위험도

LOW

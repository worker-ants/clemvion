### 발견사항

- **[WARNING]** `handleEiaEvent` 의 `execution.replay_unavailable` 분기 인라인 주석이 이번 fix 이후에도 여전히 "무조건 유지"로 서술 — SoT spec 은 정정됐는데 코드 주석만 stale 로 남음, 게다가 RESOLUTION.md 는 이 주석도 갱신했다고 **사실과 다르게** 기록
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:204-207` (현재 파일 기준. 해당 diff 는 이번 payload 의 "파일 3" 에 **포함되지 않음** — 즉 이번 라운드도 이 줄을 건드리지 않았다), 비교 대상 `spec/7-channel-web-chat/1-widget-app.md:104-112`(이번 diff, 파일 19), `review/code/2026/07/17/02_04_13/RESOLUTION.md:19`(SD1 행)
  - 상세: 이전 라운드(`02_04_13`)의 documentation 리뷰가 정확히 이 지점(당시 178행)을 WARNING 으로 지적했다 — `seedWaitingFromStatus` 가 스냅샷 terminal 시 세션을 정리하도록 바뀌었는데, `handleEiaEvent` 의 `execution.replay_unavailable` 분기 바로 위 주석은 "**종료 신호가 아니므로 스트림·세션은 유지** — 이후 이벤트는 정상 처리된다"라고 무조건 단정한다고. 이번 라운드 `RESOLUTION.md` SD1 행은 이 지적을 **fix 처리**했다고 기록하며 근거로 "§3.1 에 terminal 예외 명문화 ... `handleEiaEvent` 인라인 주석·plan 서술도 동형 갱신"이라고 명시한다. 실제로 `spec/7-channel-web-chat/1-widget-app.md` §3.1 은 이번 diff(파일 19)에서 "신호 자체는 종료를 뜻하지 않으므로 **기본적으로** 스트림·세션은 유지"로 정정되고 terminal 예외 blockquote 가 추가됐다 — spec 쪽 주장은 사실이다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(파일 4)도 동형 서술로 갱신됐다 — plan 쪽 주장도 사실이다. 그러나 **`use-widget.ts` 의 실제 코드**(현재 204-207행)를 직접 확인한 결과 `execution.replay_unavailable` 분기의 주석은 여전히 원문 그대로 "**종료 신호가 아니므로 스트림·세션은 유지** — 이후 이벤트는 정상 처리된다"이며, "기본적으로"라는 완화어도 terminal 예외에 대한 언급도 전혀 없다. 이번 payload 의 파일 3(`use-widget.ts`) diff 를 라인 단위로 전부 확인해도 204-207 근처는 어떤 hunk 에도 등장하지 않는다 — 즉 이번 라운드도, 직전 라운드도 이 줄을 실제로 고치지 않았다. 결과적으로 (1) 코드 주석이 지금 이 diff 로 확정된 동작(스냅샷이 terminal 이면 스트림·세션을 정리한다)과 정면으로 모순되는 오래된 주석으로 남아 있고, (2) `RESOLUTION.md` 라는 공식 리뷰 산출물이 "인라인 주석도 갱신했다"는 검증되지 않은/틀린 주장을 영구 기록으로 남겼다. 직전 리뷰가 정확히 경고했던 위험 — "이 주석을 근거로 향후 유지보수자가 terminal 분기를 spec/주석 위반으로 오판해 되돌리면 방금 고친 무기한 streaming 정지 버그가 재발한다" — 이 그대로 유효하다.
  - 제안: `use-widget.ts:204-207` 주석을 spec §3.1 과 동형으로 정정(예: "신호 자체는 종료가 아니므로 기본적으로 스트림·세션은 유지한다. 단 `seedWaitingFromStatus` 가 반환하는 스냅샷이 이미 terminal 이면 그 안에서 세션을 정리하고 ENDED 로 전이한다 — §3.1 참고"). `RESOLUTION.md:19` 는 소급 수정 대상은 아니나(과거 리뷰 기록), 이번 라운드의 RESOLUTION/SUMMARY 를 작성할 때 "이전 SD1 처분의 '인라인 주석 갱신' 주장이 실제로는 미이행이었다"는 점을 사실관계로 남길 것을 권장.

- **[INFO]** `seedWaitingFromStatus` JSDoc 요약 첫 줄이 여전히 확장된 책임(terminal 처리)을 반영하지 못함 — 직전 라운드 INFO 미반영, 회귀 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:246` (`"getStatus REST 응답으로 현재 waiting_for_input 표면을 시드한다."`)
  - 상세: 직전 라운드(`02_04_13`) documentation 리뷰가 동일하게 지적했던 INFO — 본문 중간(261-262행)엔 terminal 처리가 이미 문서화돼 있지만 최상단 한 줄 요약은 갱신되지 않았다. 이번 diff 는 그 최상단 줄을 건드리지 않았다(파일 3 diff 에 246행 부근 변경 없음). 저위험이라 이번 라운드 fix 대상에서 제외된 것으로 보이나, RESOLUTION.md 는 이 INFO 를 처분 목록(fix/판단기록)에서 언급하지 않아 누락 여부가 불명확하다.
  - 제안: 요약 줄을 "현재 표면을 시드하거나(waiting_for_input), 스냅샷이 이미 terminal 이면 세션을 정리하고 ENDED 로 전이한다" 정도로 확장. 급하지 않음.

- **[INFO]** `ai-review` 인용 주석 포맷이 날짜 없이 세션 시각(`02_04_13`)만 쓰는 패턴이 이번 라운드에 새로 추가된 곳에서도 반복됨 — 기존 코드베이스 관례(`ai-review YYYY-MM-DD ...`)와 계속 불일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:211` (`(ai-review 02_04_13 CRITICAL#1.)`, 이번 diff 신규), `codebase/channel-web-chat/src/widget/use-widget.ts:268, 281` (``(ai-review `02_04_13` CRITICAL#1)``, ``(ai-review `02_04_13` W2.)``, 이번 diff 신규) — 기존 미해결 사례 `use-widget-eager-start.test.ts:1240` (`(ai-review 01_42_44 requirement WARNING.)`, 직전 라운드 잔존)
  - 상세: 직전 라운드 documentation 리뷰가 정확히 이 포맷 불일치(날짜 부재 → 어느 날짜의 리뷰인지 코드만 보고 특정 불가)를 INFO 로 지적했으나 RESOLUTION.md 처분표에는 반영되지 않았고, 이번 라운드에서 같은 패턴(세션 디렉토리 시각 `02_04_13`만 인용, 날짜 없음)이 3곳 더 늘었다. 저위험이지만 인용이 누적될수록 추적 비용이 커진다.
  - 제안: `(ai-review 2026-07-17 02_04_13 CRITICAL#1.)` 처럼 날짜를 포함해 기존 관례(`execution-engine.service.spec.ts`, `oauth-provider-strategy.spec.ts` 등)와 통일. 급하지 않으나 다음 리뷰 fix 라운드에서 일괄 정정 권장.

- **[NONE]** `mapCredential` nullable 필드(`deviceName`/`lastUsedAt`) 신규 테스트(`webauthn.controller.spec.ts:35-62`)는 인라인 주석(`// 한 번도 사용 안 한 credential.`, `// toISOString() 이 아니라 null 이 그대로 나와야 한다.`)이 검증 의도를 명확히 설명해 문서화 품질 양호. 직전 라운드 I1 을 정확히 반영.
- **[NONE]** `finalizeEnded` 헬퍼(`use-widget.ts:166-190`)와 `seedWaitingFromStatus` 반환 계약(`Promise<boolean>`) 의 JSDoc 은 "왜 이렇게 바뀌었는가"(ai-review 인용 포함)까지 상세히 설명해 이 규모의 동시성/계약 변경치고 문서화 밀도가 높다. `applyConfig` 호출부(약 600-610행 부근)의 신규 인라인 주석도 CRITICAL#1 근거를 정확히 재서술.
- **[NONE]** `review/code/2026/07/17/02_04_13/**` 신규 커밋(RESOLUTION.md·SUMMARY.md·13개 reviewer `.md`·`meta.json`·`_retry_state.json`)은 CLAUDE.md 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 정확히 부합하는 산출물 보관.

### 요약
이번 diff 의 핵심(`finalizeEnded` 헬퍼 추출, `seedWaitingFromStatus` 의 `Promise<boolean>` 반환 계약, `applyConfig` 게이팅, spec §3.1 terminal 예외 명문화)은 JSDoc·spec·plan 서술이 서로 정확히 정합하고 회귀 검출용 주석 인용도 충실하다. 다만 직전 라운드가 지적한 "코드 주석이 spec 보다 뒤처졌다"는 문제(`handleEiaEvent` `execution.replay_unavailable` 분기의 "무조건 유지" 주석)가 이번 라운드에서도 실제로는 고쳐지지 않았는데, `RESOLUTION.md` 는 이를 고쳤다고 명시적으로 (그리고 틀리게) 기록했다 — spec/plan 은 정정됐지만 코드 자체의 인라인 주석은 여전히 이번 fix 의 예외 동작과 모순된다. 이는 "리뷰 산출물의 처분 기록이 실제 diff 와 어긋난" 사례이자, 직전 리뷰가 명시적으로 경고했던 재발 위험(오래된 주석을 근거로 향후 terminal 분기를 되돌리는 회귀)이 여전히 열려 있다는 뜻이다. 그 외에는 JSDoc 요약 줄 미보강·리뷰 인용 포맷 불일치 등 기존에 지적됐던 저위험 INFO 가 답보 상태로 남아있는 정도이며 새로운 CHANGELOG 필요성이나 신규 공개 API 문서 공백은 없다.

### 위험도
LOW

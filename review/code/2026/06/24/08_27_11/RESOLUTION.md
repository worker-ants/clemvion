# RESOLUTION — rebase 후 재리뷰 (08_27_11)

대상 SUMMARY: `review/code/2026/06/24/08_27_11/SUMMARY.md` (Critical 0, WARNING 12, INFO 18).

> **맥락**: 본 리뷰는 rebase 로 코드 커밋 타임스탬프가 직전 리뷰(02_44_56)를 postdate 하면서 review guard 가 재무장돼
> 수행한 **freshness 복구용 재리뷰**다. 직전 리뷰의 9 WARNING 은 이미 fix 되어 트리에 반영돼 있고(rebase 로 이월), 본
> 재리뷰는 그 위에 origin/main 의 트리거 UI 리팩토링(M-8)과 통합된 전체 피처를 다시 점검했다. **코드는 이번 라운드에서
> 동결**한다(추가 코드 변경은 가드를 재차 재무장시키므로) — 코드 변경이 필요한 항목은 defer.

## 조치 항목

| # | 발견 | 처분 |
|---|------|------|
| W-1 | `allow-same-origin` sandbox 트레이드오프 | **이미 반영** — `4-security §1` 에 트레이드오프(공급망 무결성 전제)·외부 CDN cross-origin 해소 상세 기재됨 |
| W-2 | `endpointPath` 서버 검증 미명시 | **fix(spec)** — `5-admin-console §3` 에 "콘솔은 신규 검증 미도입, 기존 webhook 생성 규약(2-trigger-list §2.5)의 형식·유일성+DB unique 가 단일 책임" 명시 |
| W-3 | `/embed-config` public 캐시 포이즌 면 | **이미 반영/dismiss** — `4-security §3-①` 에 `max-age=300`·fail-open·allow-all degrade 기재. allowlist 축소 시 TTL 잔류는 soft 컨트롤(임베드 차단은 best-effort)의 의도된 전제 |
| W-4 | `useAppearanceDraft` localStorage round-trip 테스트 | **defer** — 후속 테스트 강화. 기본 시드/dirty/markSaved 는 커버됨(use-appearance-draft.test) |
| W-5 | `LivePreview` 재마운트(key) 테스트 | **defer** — wc:boot 재전송·resize·origin 무시·타임아웃은 커버됨 |
| W-6 | `EmbedConfigService` workspace null 테스트 | **defer** — fail-open 동작은 spec 명시(4-security §3-①); 단위 케이스 후속 |
| W-7 | appearance silent-delete 동작 검증 테스트 | **defer** — spec §4 에 경고 명시됨; 회귀 테스트 후속 |
| W-8 | i18n 파일명 `web-chat.ts` vs `webChat.ts` | **이미 반영** — `§8` 이미 `webChat.ts` |
| W-9 | `getWidgetLoaderUrl()` SoT 미기재 | **이미 반영** — `§5` 에 SoT 추가됨 |
| W-10 | `status: implemented` 조기 설정 | **dismiss** — `spec-status-lifecycle` 가드가 pending_plans 비면 `partial→implemented` 강제(rule b·c). plan 완료이동과 동시 승격이 규약. partial+빈 pending 은 가드 위반 |
| W-11 | `per_trigger` 유니언 잔류 | **defer** — 의도 주석/별칭은 후속(코드 동결) |
| W-12 | `suggestions` flat↔array 변환 책임 DTO JSDoc | **defer** — 후속(코드 동결). 변환 SoT 는 `snippet-input.ts splitSuggestions`; spec §4 에 변환 규칙 기재됨 |
| INFO 1~18 | 보안 전제·범위·부작용·유지보수 다수 | **defer/현행수용** — 대부분 기존 동작·spec 기재 완료 또는 비차단 백로그 |

## 코드 동결로 defer 한 코드 항목 (후속 턴/PR)

rebase freshness 가드 루프를 피하려고 이번 라운드에 코드를 건드리지 않았다. 후속에서 처리:
- `snippet.ts` 상단 주석 서버저장 반영 정정 + `WebChatAppearance` 용도 JSDoc(consistency W3 / ai-review W-12 타입명 구분)
- 테스트 강화 W-4·W-5·W-6·W-7
- `InteractionTokenStrategy` per_trigger 의도 주석(W-11)

## TEST 결과

- **코드 무변경** — 본 라운드 산출물은 spec(`5-admin-console §3` W-2, `2-trigger-list §3`)·plan 이동·review 산출물뿐.
- 직전 post-rebase 검증 유지: backend triggers jest 135 / frontend web-chat+triggers vitest 128 / channel-web-chat 193 / backend·channel·frontend build / e2e(console+workflows) 6/6 / spec·plan 가드 1284 PASS.
- consistency `--impl-done`(08_15_32) **BLOCK: NO** (W1-3 보완 반영).

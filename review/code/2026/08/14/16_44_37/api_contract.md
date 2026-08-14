### 발견사항

- **[INFO]** 라이브 외부 REST 엔드포인트(`GET /api/external/executions/:id`)의 응답 payload 형태가 버전 표식 없이 축소됨 — 단, 이미 문서화된 계약을 사후 강제하는 보안 수정이라 실질적 breaking change 는 아님
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:98`(`function stripAndRedact`), 호출부 `:379`(`nodeOutput`)·`:441`(`result`)·`:445`(`error`)
  - 상세: `stripAndRedact` 가 기존 `deepRedactSecrets`(값 마스킹만) 앞에 `stripExternalOnlyFields`(필드 삭제, 깊이 무관)를 추가로 걸면서 `nodeOutput`/`result`/`error` 세 출구 모두에서 `llmCalls`/`meta.turnDebug[].llmCalls` 필드가 응답에서 완전히 사라진다. 이 필드는 WS §4.4 가 "모든 외부 수신자에서 strip 된다" 고 이미 선언했던 것이므로 계약 위반의 시정이지 새 계약 변경은 아니다. 다만 실제로 이 필드를 (의도치 않게) 수신해 오던 외부 클라이언트 입장에서는 응답 스키마가 조용히 좁아지는 셈이라, API 버전이나 명시적 마이그레이션 신호 없이 동작이 바뀐다. `CHANGELOG.md`(`## Unreleased — (보안) llmCalls raw 프롬프트가 외부로 새고 있었다`)가 "이미 전송된 데이터는 되돌릴 수 없고 외부 통합자가 저장했을 수 있다" 는 영향 범위를 명시적으로 적어 둔 점은 적절하다.
  - 제안: 추가 조치 불필요. 이 프로젝트의 EIA 표면에 정식 버저닝 스킴이 없는 상태(§URL 설계 항목 참조)라 별도 버전 신호를 만들기보다 CHANGELOG 공지로 갈음하는 현재 처리가 합리적이다.

- **[INFO]** (positive) `null` vs `{}` 응답 구분이 새 strip 경로에서도 보존되는지 회귀 테스트로 고정됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` — `outputData` 가 `null` 이면 `result`/`error` 는 `{}` 가 아니라 `null` 이어야 한다는 `it.each` 블록(1개 `%s` 재정렬 커밋 `9482cc0c0` 포함), 및 `nodeOutput` 이 `null` 이어도 `context` 조립이 깨지지 않는다는 케이스
  - 상세: `stripAndRedact`(`interaction.service.ts:98`)는 `value === null || value === undefined` 이면 `null` 을 반환하도록 명시적으로 처리해, 헬퍼 통합 이전 3곳에 흩어져 있던 null 가드를 하나로 접으면서도 "결과 없음"(`null`)과 "빈 결과"(`{}`)를 API 컨슈머가 구분할 수 있는 기존 계약을 유지한다. 이 구분이 깨지면 클라이언트가 "아직 결과 없음"과 "빈 객체 결과"를 오판할 수 있는 실질적 스키마 회귀인데, 전용 테스트로 명시적으로 막혀 있다.
  - 제안: 없음(확인 완료).

- **[INFO]** (positive) EIA spec 의 `interaction` URL 블록이 실제 라우트와 다른 허구의 `/v1/` 절대 URL을 쓰고 있던 것을 이번 라운드가 상대경로로 정정함
  - 위치: `spec/5-system/14-external-interaction-api.md:668`(`"submitUrl": "/api/external/executions/{id}/interact"` 등 4개 URL) — 실제 컨트롤러는 `codebase/backend/src/modules/external-interaction/interaction.controller.ts:57`(`@Controller('external/executions')`)
  - 상세: 종전 문서는 `https://api.clemvion.ai/v1/executions/{id}/interact` 형태의 절대 URL·`/v1/` 버전 세그먼트를 예시로 들었으나, 실제 구현에는 그런 버전 세그먼트가 없고(`api/external/executions/...`) `interaction` 블록 자체가 아직 어떤 emit 경로도 채우지 않는 Planned 필드다. 이번 diff 는 URL을 상대경로로 바꾸고 "이 프로젝트의 API 규약(§2-api-convention §1)은 절대 URL·버전 세그먼트를 금지한다" 는 근거를 명시하며, 블록 전체를 Planned 로 라벨링했다. 코드 변경이 아니라 문서만 실제 구현/규약과 일치시킨 정정이라 위험이 없다.
  - 제안: 없음(확인 완료). 향후 `interaction` 블록이 실제로 구현될 때 이 상대경로 표기를 기준으로 구현하면 규약 위반 재발을 막는다.

- **[INFO]** REST(`deepRedactSecrets`, `MAX_REDACT_DEPTH`/`>=`)와 WS fanout(`stripExternalOnlyFields` 내부 sibling `sanitizePayloadForWs`, `MAX_SANITIZE_DEPTH`/`>`)이 같은 깊이 상수값(10)에 서로 다른 경계 연산자를 쓰는 것은 의도된 비대칭이며 API 응답 스키마에 영향 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:29-42`("표면 형태 | 마스커 | 판정 | 마스크 토큰 | 상한" 표)
  - 상세: 두 마스킹 경로(REST 스냅샷 vs WS fanout)는 서로 다른 표면이라 마스크 토큰(`'***'` vs `'[REDACTED]'`/`'[REDACTED_DEPTH]'`)도, 경계 연산자도 다르지만, JSDoc 이 "그 깊이에서 둘 중 하나가 서브트리를 non-object 로 collapse 하므로 안전하다" 는 불변식을 명시하고, 같은 세션의 선행 리뷰 라운드(`11_02_16`/`12_06_20`)가 depth 0·5·8·9·10·11·12 전수 실측 + 뮤테이션 테스트로 실제 파이프라인 누출 없음을 검증했다. API 컨트랙트 관점에서는 응답 필드 자체(마스크 토큰 문자열)가 채널마다 다를 수 있다는 뜻이라 — REST 클라이언트는 `'***'`, SSE/webhook 클라이언트는 `'[REDACTED]'`/`'[REDACTED_DEPTH]'` 를 볼 수 있음 — 이 차이는 이미 spec 표(위 표)로 명문화돼 있어 문서화되지 않은 불일치는 아니다.
  - 제안: 없음(참고용). 신규 외부 표면을 추가할 때는 같은 표의 마스커/토큰/경계 조합을 명시적으로 선택하도록 요구하는 관례가 이미 JSDoc 에 있으므로 그대로 따르면 된다.

- **[INFO]** 인증/인가·요청 검증·페이지네이션 표면은 이번 diff 로 변경되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `isInternalCtx` 등 guard 임포트·사용부 불변, 신규 request DTO/파라미터 없음
  - 상세: 변경은 응답 payload 를 조립하는 세 지점의 후처리(strip+redact) 함수 교체에 한정되고, 토큰 검증·워크스페이스 ownership 체크·목록 API(페이지네이션 대상 없음) 로직은 손대지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 이번 라운드(`16_44_37`)의 실질 코드 델타는 직전 라운드(`16_29_50`) WARNING 1건에 대한 테스트-전용 수정(`interaction.service.spec.ts` `it.each` 튜플 순서 재배열, 커밋 `9482cc0c0`)뿐이며, 그 자체로는 API 계약에 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` (`it.each([['completed','result',...],['failed','error',...]])` 튜플 순서 `[label, field, status]` 로 재정렬)
  - 상세: `git log --since="2026-08-14 16:29:50"` 로 확인한 이번 라운드의 유일한 애플리케이션/스펙 관련 커밋이며, 테스트 타이틀 문자열 버그를 고친 것으로 실제 응답 스키마·엔드포인트 동작에는 영향이 없다. 위 발견사항들은 이 델타 자체가 아니라 브랜치 전체(누적) diff 를 기준으로 한 API 계약 재확인이다.
  - 제안: 조치 불필요.

### 요약

이번 diff 는 신규 엔드포인트·버전·요청 검증·페이지네이션·인증 변경이 없는 보안 버그 수정(외부 REST/WS 표면으로 새던 `llmCalls` debug 필드 제거)이 핵심이며, 그 수정은 이미 문서화돼 있던 WS §4.4/EIA 계약("모든 외부 수신자에서 strip 된다")을 실제로 강제하는 시정이라 신규 breaking change 로 보기 어렵다. `null` vs `{}` 응답 구분이 헬퍼 통합 후에도 회귀 테스트로 보존되고, 종전 허구의 `/v1/` 절대 URL 예시가 실제 라우트에 맞는 상대경로로 정정되는 등 계약 정합성이 오히려 개선됐다. 유일하게 유의할 점은 라이브 외부 엔드포인트의 응답 payload 가 명시적 버전 신호 없이 조용히 좁아진다는 것인데, CHANGELOG 가 그 영향 범위(이미 전송된 데이터의 외부 저장 가능성)를 별도로 공지하고 있어 완화돼 있다. 이번 라운드 자체의 실질 델타는 테스트 타이틀 문자열 수정 1건뿐으로 계약에 영향이 없다.

### 위험도
LOW

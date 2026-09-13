# RESOLUTION — 라운드 1 (`review/code/2026/09/13/10_12_19`)

Critical 0 · WARNING 5 · INFO 14 · 위험도 LOW. **전 항목 처분 완료.**
처분 커밋: `a68457936` (*"리뷰 라운드 1 — 내 주장의 마지막 층이 비어 있었다"*).

## WARNING

| # | 카테고리 | 처분 | 근거 |
|---|---|---|---|
| 1 | architecture | **고침** | `models{,.en}.mdx` 의 8갈래 문장이 `sanitize-error.util.ts` 의 수기 사본이라 무가드였다 — 이 PR 이 막으려던 클래스를 같은 표에서 다시 연 것이다. `guide-sanitized-message-parity.test.ts` 신설, **양방향** 대조(표→SoT · SoT→표). 부분집합만 보면 행 삭제가 조용히 통과한다. 뮤턴트 2건(SoT 문장 변경 · 표 행 삭제) 모두 RED |
| 2 | testing | **고침** | 실패 토스트를 렌더링하는 컴포넌트에 실패 경로 테스트가 **0건**이었다 — 이 PR 이 고친다고 주장한 증상이 있는 층이다. **정확 문자열**로 단언(느슨한 `stringContaining` 이면 버그가 있는 채로도 통과 — 그게 종전 상태다) + 사유가 빈 경우 대조군. 컴포넌트를 `result.error` 로 되돌리는 뮤턴트에 RED 확인 |
| 3 | api_contract | **부분 고침 + 등재** | 형제 `TestConnectionResultDto` 가 `code` 미선언. `code?: string` 추가(spec §9.1 이 이미 문서화하던 필드). MCP 전용 3종(`capabilities`·`serverInfo`·`preview`)은 DTO 신설이 필요해 트래커 등재 |
| 4 | maintainability | **고침** | `LlmService.testConnection` 의 근거 주석이 **파라미터 목록 안**에 있어 시그니처를 끊었다 → JSDoc 으로 이동 + `@returns` 에 실패 shape 명기 |
| 5 | maintainability | **고침** | `collectBackendTokens(files)` 의 인자가 실제로는 파일 **내용** 문자열 → `fileTexts` |

## INFO — 조치한 것

| # | 처분 |
|---|---|
| 7 | `impl-anchor-existence.test.ts` 의 *"아직 `api-endpoint` 실사례 없음"* 주석이 이 PR 의 앵커로 낡았다 → 정정. 단 실 콘텐츠 커버리지는 **우연**이라(그 앵커가 지워지면 분기가 다시 무검증) 합성 케이스는 남긴다고 명시 |
| 9 | 축 1 이 줄 단위 판정이라 여러 줄로 쪼갠 `<FieldTable>` 행은 놓친다 → **놓치는 것 자체를 테스트로 단언**해 경계를 코드에 남겼다 |

## INFO — 조치 불요 (사유 기록)

- **1·2 (security)**: `sanitizeLlmErrorMessage` 가 8갈래 고정 문구만 반환해 provider 원문 미노출, `logUsage` 미호출로 워크스페이스 노출 로그 재전파 없음 — 양성 확인.
- **3·5 (performance·architecture)**: 가드 전량 스캔은 선형이고 자매 가드와 동일 패턴. 두 유사 DTO 통합은 **세 번째 유사 결함 시** 재검토(현재 2회).
- **4·8 (architecture·testing)**: 유령 필드 방향은 런타임이 원리적으로 못 본다 — 이 PR 이 스스로 문서화했고, 라운드 3 에서 **정적 스캐너로 등재**했다.
- **6 (requirement)**: `ModelTestConnectionResultDto.message` 의 `nullable: true` 는 기존 상태 유지, §5.4 판정표상 위반 아님.
- **10·11 (문서/스펙)**: spec 갭 3건 — developer 권한 밖이라 트래커에 planner 항목으로 등재 완료.
- **12 (user_guide_sync)**: `ERROR_KO` 미매핑은 `#1328` 에서 이미 별도 트래커로 분리.
- **13·14 (dependency·side_effect)**: 신규 의존성 0건, rename 의 blast radius 는 전수 확인 + CHANGELOG 고지.

## 검증

`run-test-all.sh` ALL PASS (lint · unit · build · e2e 307) · 타입체크 ratchet 둘 baseline 일치 ·
라운드 1 뮤테이션 3건 전부 RED.

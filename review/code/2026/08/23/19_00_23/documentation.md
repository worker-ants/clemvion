# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `getStatus` JSDoc 의 "잔여 항목" 서술이 이번 PR 로 stale 화됐다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:315`
  - 상세: `getStatus()` 위 JSDoc 이 `**보안 제약**` 절에서 *"`conversationThread` 의 turn 텍스트 불변식은 ... 자동 강제된다 (EIA §R17). `outputData`/`nodeOutput` 키-allowlist 는 별개 잔여 항목."* 이라고 적고 있다. 이 PR 이 바로 그 "별개 잔여 항목"(`allowlistNodeOutputKeys`)을 `getStatus` 의 waiting `nodeOutput` 출구에 구현했는데, 이 문장은 그대로 남아 여전히 "미구현" 인 것처럼 읽힌다. 같은 파일의 `stripAndRedact` JSDoc(파일 컨텍스트 85~117행)과 `spec/5-system/14-external-interaction-api.md` §R17 은 이번 diff 에서 정확히 갱신됐는데(표로 3-출구/2-채널 범위를 열거), 정작 그 근거를 인용하던 `getStatus` 자신의 JSDoc 문장만 갱신 대상에서 빠졌다.
  - 제안: 이 문장을 spec §R17 표와 동일한 정밀도로 갱신 — 예: *"`outputData`/`nodeOutput` 키-allowlist 는 `getStatus` waiting 출구에 한해 fail-closed 로 적용됐다(EIA §R17); SSE/fanout(`toFanoutEnvelope`)은 여전히 deny-list 잔여."* 처럼, "별개 잔여 항목" 이라는 이제-거짓인 서술을 대체할 것.

- **[WARNING]** 이 저장소의 확립된 CHANGELOG 관례에 반해, 이번 보안 강화(fail-open → fail-closed)에 대한 `CHANGELOG.md` 항목이 없다
  - 위치: `CHANGELOG.md` (신규 항목 부재 — diff 대상 파일 목록에 `CHANGELOG.md` 자체가 없음)
  - 상세: `CHANGELOG.md` 는 바로 이 `getStatus`/`nodeOutput` 표면에 대한 거의 동일한 선례를 이미 갖고 있다 — `## Unreleased — (보안) llmCalls raw 프롬프트가 외부로 새고 있었다 — fanout(depth-1) + REST 스냅샷` (`CHANGELOG.md:424`)은 "같은 `getStatus` 의 `nodeOutput` 이 값은 마스킹되지만 필드는 안 지워져 샜다"는 사실을 발견 배경·영향 범위(외부 통합자가 이미 저장했을 수 있다는 운영 경고)까지 포함해 기록했다. 이번 PR 은 그 후속으로 **같은 `nodeOutput` 필드에서 엔진 내부 `_retryState` 가 동일한 방식(fail-open deny-list 한 칸)으로 새고 있었다**는, 성격이 동일한 발견이다. 그런데도 이번 diff 에는 CHANGELOG 항목이 없다. 이 저장소는 워크스페이스 JWT/토큰 인증 표면의 필드-스트립 보안 수정마다 예외 없이 CHANGELOG 항목을 남겨 왔다(`llmCalls` 항목 외에도 라인 195, 285, 569 등 다수 선례). 이 항목 없이는 이전에 저장됐을 수 있는 `_retryState` 데이터에 대한 "영향 범위" 운영 경고(선례가 항상 붙였던 그 문단)가 어디에도 남지 않는다.
  - 제안: `CHANGELOG.md` 에 `llmCalls` 항목과 같은 형식으로 새 `## Unreleased` 절 추가 — 발견 배경(`_retryState` 가 `retry-turn.service.ts` 를 통해 `NodeExecution.outputData` 에 저장되는데 deny-list 가 `llmCalls` 한 칸이라 통과했다는 것), 수정 내용(fail-closed allowlist, `getStatus` 1곳 한정, SSE/fanout 은 잔여), 그리고 이미 노출됐을 수 있는 과거 데이터에 대한 영향 범위 문단을 포함할 것.

## 요약

전반적으로 문서화 품질은 이 저장소 평균 대비 상당히 높다. `NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys` 의 JSDoc 은 "왜 deny-list 로 부족한가 → 타입 결속 근거 → 최상위만 거르는 이유 → 다른 두 출구/SSE 에는 왜 안 걸었는가"를 빠짐없이 설명하고, `spec/5-system/14-external-interaction-api.md` §R17 은 취소선(`~~미구현·잔여~~`)으로 이전 서술을 명시 갱신하며 REST 1곳 적용/terminal 2곳 의도적 제외/SSE 잔여를 표로 열거해 이 저장소가 §R17 에서 반복 겪은 "부분 해소를 전체로 flip" 패턴을 정확히 피했다. `plan/in-progress/nodeoutput-allowlist.md` 는 착수 전 프로브·뮤테이션 예측/실측·게이트 수치까지 투명하게 기록했고, 상위 트래커(`spec-sync-external-interaction-api-gaps.md`)의 SSE/fanout 잔여 항목 신설과 `[x]` flip 도 consistency check WARNING 을 그대로 반영해 처리됐다. 다만 (1) 이번에 실제로 구현된 allowlist 를 아직 "잔여 항목"이라고 부르는 `getStatus` 자신의 stale JSDoc 문장 1곳과, (2) 동일 표면·동일 성격의 선행 보안 수정이 항상 남겼던 `CHANGELOG.md` 항목이 이번엔 빠진 점, 두 가지가 정정 없이 남아 있다.

## 위험도
MEDIUM

# 문서화(Documentation) Review

## 검토 방법

diff 로 제시된 8건의 JSDoc/주석/이름 정정을 각각 실측(grep·git log·git show)으로 대조했다.
확인한 것: `deleteByPrefix` 의 유일 프로덕션 호출부(`trigger-resource-release.ts` 의
`deleteTriggerSecretsAfterCommit`, `undoAbsentTriggerWrite` 도 그 함수를 경유), `TRIGGER_DELETE_LOCK_TIMEOUT_MS`
소비자(트리거·스케줄 삭제 + 부모 삭제의 `setLocalLockTimeout` 직접 호출), `teardownChannelConfig`→
`teardownRegisteredChannel` rename 뒤 구 이름 잔존 0건, `SUMMARY#24`/`18_45_09` bare 인용이 가리키는
커밋(`ad0ea7cdb`)·세션 디렉터리 이력 실재, 그리고 이번 정정이 없앤 결함 클래스("secret 삭제"·"한 곳뿐"·
`remove()` 단독 서술)의 저장소 전수 재발 여부(0건).

## 발견사항

- **[INFO]** plan 체크리스트가 같은 커밋에 포함된 작업 완료 상태를 아직 반영하지 않음
  - 위치: `plan/in-progress/trigger-release-stale-comments.md` `## 체크리스트` 섹션
    (`- [ ] 1~8 적용`)
  - 상세: 커밋 `537488983`(이 diff)의 diff 본문에는 plan 이 나열한 1~8 항목(파일 1·2·3·4·5·9 의
    JSDoc/주석/이름 정정)이 이미 전부 적용되어 있는데, 같은 커밋에 포함된 plan 파일 자체의
    체크박스는 `- [ ] 1~8 적용` 로 미체크 상태다. `status: in-progress` 이고 이후
    lint·unit·build·e2e → `/ai-review` → `--impl-done` 순서가 남아 있어 세션 내에서 갱신될
    여지는 있지만, 이 스냅샷만 보면 plan 문서가 서술하는 진행 상태와 실제 코드 diff 상태가
    어긋난다.
  - 제안: 이 PR 을 마무리하는 커밋에서 1~8 항목 체크 + `complete/` 이동 여부를 실제 병합 시점
    상태와 맞출 것 (프로젝트 관례상 "체크와 이동은 한 동작"으로 처리).

- **[INFO]** plan 실측표 자체가 이미 consistency-check 에서 지적된 좁음(참고, 중복 아님)
  - 위치: `plan/in-progress/trigger-release-stale-comments.md` 실측표 `#4` 행
  - 상세: `review/consistency/2026/09/18/11_26_25/plan_coherence.md`(INFO#2, SUMMARY#2 로 이미
    통합됨)가 지적한 대로, `teardownChannelConfig`→`teardownRegisteredChannel` 리네임 실측표
    행이 정의부(`chat-channel-binder.service.ts`)만 적고 실제로 함께 고친 호출부
    (`trigger-resource-releaser.service.ts`·`.spec.ts`)를 표에 나열하지 않는다. 코드 자체는
    두 호출부 모두 정확히 고쳤음을 diff 로 확인했다 — 실측표 **문서**만 실제 변경 범위보다
    좁다. 이미 이 저장소의 consistency-check 산출물에 기록되어 별도 신규 지적은 아니며, 차단
    사유가 아니라는 점도 그 SUMMARY 가 명시한다.
  - 제안: 착수 전 권장 조치가 이미 SUMMARY 에 있으므로 그대로 따르면 됨 — 이 문서화 리뷰
    관점에서는 추가 조치 불요, 참고로만 남긴다.

## 확인된 양호 사항 (참고)

- 8건의 정정 전부 실측 근거가 diff/plan 표에 구체적으로 남아 있고(호출부 grep 결과, git log
  커밋 SHA, 세션 디렉터리 경로), "지금은 안전하다"류 주장에 항상 "언제 깨지는가"(호출부가 하나
  더 생기면)까지 같이 적어 다음 사람이 재검증할 수 있게 했다.
  (`codebase/backend/src/modules/secret-store/secret-resolver.service.ts`,
  `codebase/backend/src/modules/triggers/trigger-config-lock.ts`)
- 메서드 rename(`teardownChannelConfig`→`teardownRegisteredChannel`)이 정의부·모든 호출부·
  테스트 mock·이벤트 라벨까지 일관되게 반영됐고, 새 JSDoc 이 `{@link teardownChatChannel}` /
  `{@link teardownRegisteredChannel}` 상호 링크로 두 메서드의 역할 차이(저장된 config vs 넘겨받은
  config)를 명확히 구분한다.
  (`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`)
- bare 리뷰 인용 2건(`SUMMARY#24`, `18_45_09`)을 `spec/conventions/review-citations.md` 규약대로
  `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>` 전체 경로로 정정했고, 세션 디렉터리가 워킹트리에는
  없지만 git 이력에는 남아 있다는 점까지 밝혀 다음 사람이 "인용이 깨졌다"고 오판하지 않게 했다.
  (`codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`,
  `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`)
- `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 이 "소비자 목록을 다시 적지 않는다"는 방향으로 설계를
  바꿨다 — 같은 목록이 이미 두 번(과대 서술 → 소비자별 서술) 낡아진 이력을 근거로 원리적으로
  안 낡는 형태(규칙만 서술 + SoT 를 spec 로 위임)를 택한 판단이 타당하다.
  (`codebase/backend/src/modules/triggers/trigger-config-lock.ts`)
- README/CHANGELOG/환경변수 문서에 영향을 주는 변경은 없다(동작 변경 없음, 순수 주석·이름
  정정). API 표면·설정 옵션 변경도 없어 해당 항목들은 검토 대상 밖이다.

## 요약

이번 PR 은 "주석과 코드가 갈라진" 결함 클래스(트리거 삭제 자원 정리 #1346 이 남긴 stale
comment/이름 8곳)를 정정 이력·grep 실측과 함께 닫는 순수 문서화 PR 이다. 8건 모두 현재
코드 동작과 대조해 정확함을 직접 재현 검증했고, 리네임의 호출부 전수 반영·bare 인용 해소·
"안전은 호출부 목록이 그대로일 때만 참"이라는 취약점 서술까지 품질이 높다. 유일한 흠은
같은 커밋에 포함된 plan 문서의 체크리스트가 그 커밋 자체가 담은 진행 상태를 아직 반영하지
않는다는 점(INFO, in-progress 세션 내에서 정리될 여지 있음)과, plan 실측표의 좁은 서술(이미
consistency-check 가 INFO 로 기록·비차단 처리함)이다. CRITICAL/WARNING 급 문서화 결함은
없다.

## 위험도

NONE

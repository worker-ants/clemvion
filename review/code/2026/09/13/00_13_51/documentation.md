# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `isUuidShaped` 의 JSDoc(uuid.ts) — "캐너리는 이 둘뿐" 이라는 닫힌 목록이 바로 이 diff 로 다시 낡았다
  - 위치: `codebase/backend/src/common/utils/uuid.ts:27-32` (`isUuidShaped` 함수 docstring, "앵커 정정 (2026-08-09, `#1112` 실측)" 문단)
  - 상세: 이 docstring 은 "진짜 캐너리는 `uuid.spec.ts` 의 두 술어 경계 테스트와 `workspace-context.util.spec.ts` 의 nil UUID 통과 테스트다" 라고 **닫힌 목록**으로 단언한다. 그런데 이번 diff 는 `login-history.service.ts`·`background-runs.service.ts` 두 곳에 `isUuidShaped` 호출부를 새로 추가하고, 각각 `[대조군]` 회귀 테스트까지 붙였다 — 즉 지금은 캐너리가 최소 4곳이다. `uuid.ts` 자체는 이번 diff 에 포함되지 않아 이 닫힌 목록이 갱신되지 않았다.
    같은 diff 안의 `codebase/backend/src/common/utils/uuid.spec.ts:56-68` 은 정확히 같은 종류의 실수("호출부는 한 곳뿐" 이라고 적혀 있었다 — `#1328` 후속 배치가 그 문장을 거짓으로 만들었다)를 스스로 지적하며 "개수를 다시 박지 않는다, grep 으로 세는 법을 적는다" 는 방식으로 고쳤다. 그런데 그 수정은 `uuid.spec.ts` 에만 적용됐고, 정작 `uuid.spec.ts` 자신이 "SoT" 라고 지목하는 `uuid.ts` 의 docstring 은 여전히 옛 방식(닫힌 목록)을 쓰고 있다 — 이 저장소가 반복해 겪는다고 스스로 기록해 둔 "자매 중 하나만" 패턴이 문서 레벨에서 재발한 것이다.
  - 제안: `uuid.ts` 의 해당 문단도 닫힌 테스트 목록 대신 `uuid.spec.ts` 와 같은 grep 기반 서술(또는 최소한 두 새 소비처 언급)로 갱신한다. 별도 커밋이어도 무방하지만, 방치하면 다음 소비처 추가 시 다시 거짓 문장이 된다.

- **[INFO]** `login-history.service.ts`/`background-runs.service.ts` 의 근거 주석 ~12줄이 거의 그대로 복제됨 — 이미 등재·추적 중
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-64`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177`
  - 상세: 두 파일의 `decodeCursor` 에 `isUuidShaped` 선택 이유·22P02→500 마스킹 메커니즘·spec Rationale 인용이 거의 동일한 문장으로 중복 삽입돼 있다. 다만 이는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 developer 항목으로 등재되어 있고("두 커서 디코더에 같은 근거 주석이 복제됐다", `/ai-review 23_19_03` maintainability INFO#1), 이번 배치에서 안 고친 이유("주석-only 라 수렴 기준에 안 걸리고, 고치면 codebase 를 다시 리뷰해야 함")도 명시돼 있다. 새로운 조치는 불필요 — 추적 상태만 확인.

- **[INFO]** `BackgroundRunsService.decodeCursor` 는 자신의 인코딩 규약(짝 함수 `encodeCursor` 포함)을 설명하는 상위 docstring이 없다 — pre-existing gap
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`decodeCursor`/`encodeCursor` 정의부, 대략 149번째 줄 부근 private 메서드)
  - 상세: 자매 파일 `login-history.service.ts` 는 모듈 레벨 `encodeCursor` 위에 "cursor 인코딩: `<iso>|<id>` … 손상된 cursor 는 무시하고 첫 페이지부터" 라는 docstring 을 두고 있다(38-41행). `background-runs.service.ts` 쪽은 `CursorPayload` 인터페이스에 필드별 인라인 주석만 있고 인코딩 전체 규약(실패 시 400 `INVALID_CURSOR` 라는 계약 포함)을 설명하는 요약 docstring 이 없다. 이번 diff 가 새로 만든 결함은 아니며, id 검증 로직 자체는 이번에 상세히 주석됐으므로 우선순위는 낮다.
  - 제안: 필수는 아니나, 다음에 이 파일을 만질 때 `encodeCursor` 위에 짧은 요약 docstring 을 추가하면 두 자매 파일의 문서 밀도가 대칭이 된다.

## 요약

CHANGELOG·plan 문서(`keyset-cursor-uuid-validation.md`)·회귀 테스트 주석은 이례적으로 꼼꼼하다 — 관측 가능한 동작 변경 2건을 표로 명시하고, 기각한 대안(필터 22P02→400)의 근거를 spec 인용과 함께 남겼으며, 두 서비스 파일의 인라인 주석이 왜 `isUuidShaped`(느슨한 술어)를 골랐는지, 왜 두 엔드포인트의 처분이 다른지를 정확히 설명한다. spec 문서 참조(`spec/data-flow/12-workspace.md §Rationale`, `spec/5-system/3-error-handling.md §1`)도 모두 실재 문구와 일치함을 확인했다. 다만 이번 변경이 `isUuidShaped` 의 소비처를 2곳에서 4곳으로 늘렸는데도, 그 함수의 "SoT" 로 지목된 `uuid.ts` 자체의 docstring(캐너리를 닫힌 목록으로 단언하는 문단)은 갱신되지 않아 다시 낡았다 — 같은 diff 가 `uuid.spec.ts` 에서 스스로 고친 바로 그 실수 패턴이다. 나머지는 이미 후속 트래커에 등재되어 있거나 우선순위가 낮은 사전 존재 갭이다.

## 위험도

LOW

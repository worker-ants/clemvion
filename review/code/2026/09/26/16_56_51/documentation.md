# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 트래커의 교차 참조가 존재하지 않는 경로(`plan/complete/...`)를 가리킴 — 같은 파일을 다른 문서가 `in-progress` 로 서술
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5154`
  - 상세: `1 · 5 · 7 은 ED-AI-19 표기 정정(`plan/complete/spec-draft-ed-ai-19-status.md`)과 같은 뿌리다` 로 적혀 있으나, 실제로 이 draft 파일은 `plan/in-progress/spec-draft-ed-ai-19-status.md` 에 있고 그 파일 자신의 frontmatter 도 `status: in-progress` 다(`plan/in-progress/spec-draft-ed-ai-19-status.md:3`). 같은 PR 의 `plan/in-progress/assistant-e2e-contract-gaps.md:38`(검토 경고 처리 표)는 같은 파일을 정확히 `plan/in-progress/spec-draft-ed-ai-19-status.md` 로 인용한다 — 두 문서가 같은 파일의 위치를 다르게 서술한다. `find plan -iname "*ed-ai-19*"` 실측 결과 `plan/complete/` 경로에는 해당 파일이 존재하지 않는다.
  - 제안: `plan/complete/spec-draft-ed-ai-19-status.md` → `plan/in-progress/spec-draft-ed-ai-19-status.md` 로 정정하거나, 이 PR 에서 해당 draft 를 `plan/complete/` 로 실제 이동시킬 계획이면 그 이동을 이 PR 체크리스트에 명시. 현재 상태로는 그 경로를 따라가는 다음 사람이 빈 디렉터리를 만난다.

## 확인 완료 (문제 없음)

- `spec/3-workflow-editor/_product-overview.md` ED-AI-19 행에 붙인 `_(미구현 — 계획, [§4-ai-assistant §12.2](./4-ai-assistant.md#122-실행디버깅))_` 표기는 선례 ED-DB-05 행(`_(미구현 — 로드맵, [§3-execution §6](...))_`, 134행)과 형식이 동일하고, 앵커 `#122-실행디버깅` 은 대상 헤딩 `### 12.2 실행/디버깅`(`spec/3-workflow-editor/4-ai-assistant.md:714`)과 실측 일치한다.
- `codebase/backend/test/workflow-assistant.e2e-spec.ts` 새 주석들은 실측과 일치한다: "이 컨트롤러는 200 만 낸다"는 `workflow-assistant.controller.ts:88-111`(`latest` 핸들러에 분기 없음)와 일치, "`ParseUUIDPipe` 가 400"·라우트 순서 주석은 컨트롤러 자체의 기존 NOTE(85-87행)와 일치, "`findLatestActive` 는 `lastInteractionAt` 내림차순" 주석은 `workflow-assistant-session.service.ts:52-60` 구현과 일치. 도구 호출 "두 끝"(전부 채움/전부 뺌) 주석도 실제로 추가된 `call_2` 오브젝트(선택 키 4종 전부 누락)와 일치한다.
- CHANGELOG 미기재 판단("한 기능의 동작을 고정하는 테스트 추가(가드가 아닌 커버리지)는 항목을 내지 않는다")은 `CHANGELOG.md` 상단 기준 문구와 축자적으로 일치 — 정확한 근거 인용이다.
- `plan/in-progress/assistant-e2e-contract-gaps.md` 의 "이 e2e 파일은 어떤 spec 의 `code:` 에도 등재되지 않았다" 주장은 `grep -rl "workflow-assistant.e2e-spec.ts" spec/` 0건으로 실측 일치.
- e2e 테스트 파일 모듈 상단에 목적·범위를 설명하는 JSDoc 스타일 블록 주석이 이미 있고(SSE 는 예외적으로 e2e 가 담당한다는 설명 포함), 새로 추가된 두 단언 블록(F 의 `data: null` 분기, H 의 도구 호출 두 번째 원소)도 "왜 이렇게 테스트하는지"를 각각 인접 인라인 주석으로 설명한다 — 인라인 주석 밀도는 이 PR 범위에서 충분하다.
- 새 환경변수·설정 옵션·API 엔드포인트 변경 없음(테스트 커버리지 확장 + 기존 spec 표기 정정뿐) — README/API 문서 업데이트 대상 없음.

## 요약

이번 변경은 테스트 커버리지 확장(e2e 세 칸)과 그로부터 파생된 spec 표기 정정 한 건으로, 새로 작성된 주석·plan 문서의 실측 근거는 컨트롤러·서비스 구현 및 CHANGELOG 기준 문구와 대조했을 때 전부 정확했다. 유일한 흠은 트래커 문서(`spec-draft-nullable-notation-followups.md`)가 같은 세션에서 만든 다른 plan 파일의 위치를 `plan/complete/` 로 잘못 인용해, 같은 PR 안의 다른 문서(`assistant-e2e-contract-gaps.md`)와 서로 다른 경로를 가리키는 내부 불일치가 생겼다는 점이다. 이는 제품 동작에 영향을 주지 않는 plan 상호참조 오류이므로 WARNING 수준이다.

## 위험도

LOW

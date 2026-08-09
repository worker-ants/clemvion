# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** plan frontmatter `worktree:` 값이 작업 내용과 무관해 보이는 worktree 명으로 바뀜
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:3`
  - 상세: `worktree: auth-guard-reflection-hardening-9c31f2` → `worktree: harness-changeset-exclusion` 로 변경됐다. 이 PR 의 실제 작업(`workspace-id-fixtures` 값 유일성 가드 + nil-UUID 캐너리 문단 SoT 통합)은 plan 본문 체크리스트에 이미 "이번엔 안 함" 으로 등재돼 있던 후속 항목이라 diff 자체는 계획된 범위와 정확히 일치한다. 다만 이번 worktree 이름(`harness-changeset-exclusion`)이 이 plan 의 주제(`auth-guard-reflection-hardening`)와 무관해 보여, 다른 목적으로 만들어진 worktree 를 재사용해 이 후속 작업을 수행한 것으로 읽힌다. 코드 diff 자체의 스코프 위반은 아니지만, plan-lifecycle 추적(어느 worktree 가 이 plan 을 "소유" 하는지) 관점에서 향후 혼동 소지가 있다.
  - 제안: worktree 재사용이 의도된 것이라면 문제 없음. 아니라면 실제로 사용 중인 worktree 명과 plan 주제가 일치하는지 재확인.

## 요약

`git diff --stat` 로 확인한 실제 변경 파일 4개(`workspace-id-fixtures.spec.ts` 신설, `workspace-id-fixtures.ts`, `uuid.spec.ts`, plan md)가 프롬프트에 제시된 4개 파일과 정확히 일치하며, 숨겨진 추가 변경은 없다. 코드 diff 는 plan 파일이 스스로 문서화한 두 개의 선재 후속 항목(①공용 픽스처 모듈에 값 유일성 런타임 가드 추가, ②nil-UUID 캐너리 근거/앵커 정정 문단을 `uuid.ts` docstring 한 곳으로 통합하고 나머지는 포인터로 축약)에 정확히 대응한다. `workspace-id-fixtures.ts` 의 `ALL_WS`/`assertAllUnique` 추가와 로드 시점 호출, 신설 spec 파일의 6개 테스트(정상 상태·중복 감지·메시지 내용·경계값·배선 검증·export 자동 추출 대조)는 모두 그 가드 하나의 계약을 겨눈 것으로 범위 밖 리팩토링이나 기능 확장이 없다. `uuid.spec.ts` 의 주석 변경은 중복 서술 제거이되, SoT 에 없던 사실("유일한 방어선" 등)은 보존해 정보 손실 없이 축약했다. plan md 변경은 완료 표시·근거 갱신뿐이며 무관한 항목을 건드리지 않았다. 포맷팅·임포트·설정 파일의 부수 변경도 없다. 유일한 지적은 plan 의 `worktree:` 필드가 현재 디렉터리명과 주제상 이질적이라는 점(INFO, 프로세스 위생 이슈로 코드 스코프 자체와는 무관).

## 위험도
NONE

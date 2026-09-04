# Cross-Spec 일관성 검토 — spec/5-system (impl-done, 재검토)

## 검토 범위 요약

`spec/5-system/**` 자체의 델타는 이번에도 0파일(`git diff origin/main...HEAD --stat -- spec/`
확인 — 이 브랜치는 spec 을 바꾸지 않았다). `plan/` 은 `spec-draft-nullable-notation-
followups.md` 1파일만 변경(66+/16-). 실제 코드 diff는 `origin/main...HEAD` 누적 16파일/
1262줄이며, 이 중 spec 표면과 접점이 있는 것은 여전히 다음 2개 프로덕션 DTO뿐이다:

- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
- `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`

나머지(`source-scan.ts`·`temp-fixture.ts`·`nullable-type-lie-cast-guard.ts`·
`swagger-dto-contract-guard.ts` 등)는 전부 backend 내부 repo-guard/test-utils 코드로,
cross-platform 경로 정규화(`toPosixRelative`)·AST 기반 재작성 등 **spec 표면과 무관한
tooling 하드닝**이다.

이 세션(`13_00_49`)은 동일 브랜치의 **이전 cross-spec 검토(`review/consistency/2026/09/04/
11_33_21/cross_spec.md`) 이후 진행된 후속 커밋들**을 대상으로 한다. 이전 회차의 유일한
발견(WARNING — §5.4 응답 전용 규칙을 요청 DTO 에 인용)이 그 사이 어떻게 처리됐는지를
`git log`/`git show` 로 직접 추적해 재판정했다.

---

## 발견사항

### [INFO] 이전 WARNING(§5.4 요청/응답 스코프 불명확)은 코드·plan 레벨에서 해소됐고, spec 본문 수정만 planner 턴으로 남아 있다

- **target 위치**: `spec/5-system/2-api-convention.md` §5.4(`## 5. 응답 형식` 하위) — 현재도
  "본 절은 응답 바디 전용" 이라는 명시적 스코프 문구는 **여전히 없다**(직접 재확인:
  `sed -n '/### 5.4/,/^## 6/p' spec/5-system/2-api-convention.md`, 11_33_21 회차 시점과
  텍스트 동일).
- **충돌 대상**: 이전 회차 cross_spec 리포트(`11_33_21`), 커밋 `4be1249f1`("docs(review):
  impl-done WARNING 2건 — 낡은 plan 참조 + §5.4 를 요청 DTO 에 인용", `git merge-base
  --is-ancestor 4be1249f1 HEAD` → 참, 현재 HEAD 의 조상), `plan/in-progress/spec-draft-
  nullable-notation-followups.md` §5.4 drift 배치 항목.
- **상세**: 이전 회차가 지적한 3갈래 제안이 실제로 어떻게 됐는지 확인했다.
  1. **CHANGELOG 문구 정정** — 완료. `CHANGELOG.md` 의 `llmConfigId` 항목이 이제 "고친 것은
     OpenAPI 선언과 TS 타입의 내부 일치뿐이고, §5.4 는 `## 5. 응답 형식` 하위 절이라 요청
     DTO 에는 적용되지 않는다"는 인용구를 명시적으로 담고 있다(커밋 `4be1249f1` diff 로
     직접 확인).
  2. **PATCH tri-state 필드를 drift 배치에서 카테고리째 제외** — 완료. `plan/in-progress/
     spec-draft-nullable-notation-followups.md` §5.4 drift 배치 항목에 "⛔ 요청 DTO 는 이
     배치에서 카테고리째 제외한다 (`--impl-done` `11_33_21` cross_spec)" 문구가 그대로
     들어가 있다(라인 250 부근).
  3. **§5.4 본문에 "응답 바디 한정" 스코프 문구 추가** — **아직 미착수**. 같은 plan
     문서에 "§5.4 에 응답 바디 한정 스코프 문구 (planner, `--impl-done` `11_33_21`
     cross_spec)" 가 `- [ ]` 미체크 항목으로 정확히 등재돼 있다(라인 270). 이 항목은
     `spec/` 쓰기가 필요해 developer 권한 밖이고, 그 사실이 plan 에 명시돼 있다 — CLAUDE.md
     의 역할 분리 규약과 일치하는 정상적인 이월이다.
- **제안**: 새 조치 불필요 — planner 가 다음 `spec/` 턴에서 §5.4 에 "본 절(DTO 선언 형태
  규칙)은 응답 바디에 적용되며, 요청 바디의 부분 업데이트 tri-state(키 생략=불변, `null`=
  초기화)는 대상 아님" 문구를 추가하면 이 항목은 종결된다. 그 전까지는 CHANGELOG·plan 의
  주석이 오독을 이미 차단하고 있어 즉시 위험은 없다.

### 참고 — 독립 검증: `BackgroundRunResponseDto` 수정이 실제로 spec 과 일치하는지 직접 확인

이전 회차 리포트가 "background-run-response.dto.ts 8필드 수정이 `spec/4-nodes/1-logic/
12-background.md` 와 정합적"이라고 결론 냈는데, 이번 회차에서 그 주장을 직접 재확인했다.
`spec/4-nodes/1-logic/12-background.md` 라인 226-245 는 응답 예시에서
`"completedAt": null` / `"durationMs": null` 을 보이고, 표에서 `completedAt`·`durationMs`·
`nodeExecutions.nextCursor` 를 전부 `ISO8601 | null` / `number | null` / `string | null` —
"상시 존재 + null 가능"으로 명시한다. 이는 diff 가 `@ApiPropertyOptional` → `@ApiProperty({
nullable: true })` 로 고친 방향과 정확히 일치한다 — **수정 전(구 코드)이 오히려 이 spec 과
어긋나 있었고, 이번 diff 가 그 어긋남을 바로잡았다.** 새로운 충돌 없음.

---

## 요약

`spec/5-system/**` 자체는 이번 라운드에도 변경되지 않았고(델타 0), 코드 diff 는 이전
cross-spec 회차(`11_33_21`)가 이미 검토한 Swagger DTO 계약 정합화 + 그 이후 4라운드
(1R~4R)의 test/guard 하드닝(경로 정규화, AST 파서 전환, mutation 검증 보강)으로 구성된다.
이 하드닝 라운드들은 전부 backend 내부 tooling 코드에 국한돼 spec 표면과 접점이 없다.
이전 회차의 유일한 cross-spec 발견(§5.4 가 응답 전용 규칙인데 요청 DTO 인용에 쓰인 것)은
커밋 `4be1249f1`(현재 HEAD 의 조상)에서 CHANGELOG 정정 + plan 상 PATCH tri-state 카테고리
제외로 실질적으로 해소됐고, 유일한 잔여 조치(spec 본문에 "응답 바디 한정" 스코프 문구
추가)는 developer 권한 밖이라 planner 턴 대기 항목으로 정확히 이월돼 있다 — 이는 결함이
아니라 정상적인 역할 분리다. `BackgroundRunResponseDto` 수정을 `spec/4-nodes/1-logic/
12-background.md` 원문과 직접 대조해 정합성을 재확인했다. 새로운 CRITICAL/WARNING 은
발견되지 않았다.

## 위험도

LOW

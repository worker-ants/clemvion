# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 범위 요약

- scope `spec/5-system/` 델타: 0개 파일 (이 브랜치는 spec 을 바꾸지 않았다 — 정상).
- 구현 diff: 16개 파일 / 1262줄. 핵심은 (1) `entity-nullable-column-type-mismatch` 축 배치 3
  정리(`source-scan.ts`/`temp-fixture.ts` 등 repo-guard 인프라 리팩터 + `toPosixRelative`
  크로스플랫폼 정규화 추출), (2) OpenAPI 선언과 TS 타입이 어긋난 "계약 거짓" 9곳 수정
  (`background-run-response.dto.ts` 8곳 + `create-assistant-session.dto.ts` `llmConfigId` 1곳),
  (3) 신규 가드 `swagger-dto-contract-guard.ts`/`.spec.ts` 추가.
- 전문 확보: `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md` 전문 +
  `spec/conventions/swagger.md`, `spec/conventions/audit-actions.md` 전문. 나머지
  `spec/5-system/*` 16개·다수 `spec/conventions/cafe24-*` 등은 예산 초과로 생략(그 파일들에
  대한 CRITICAL 판정은 보류 — "없다"의 근거로 쓰지 않음).
- 대조 자료: `plan/in-progress/spec-draft-nullable-notation-followups.md` (같은 세션의
  `--spec` 검토가 이미 반영된 draft, `spec_impact` 대상이 `2-api-convention.md`/`swagger.md`
  포함). `git log -1 origin/main` == `cce8a188b`(이 draft 의 spec 반영 커밋) — 즉 §2.2/§5.4
  정정은 **이미 origin/main 에 병합**돼 있고 본 브랜치는 그 위에서 코드만 고쳤다.

## 발견사항

### [WARNING] `spec/5-system/2-api-convention.md §5.4` — "응답 바디 한정" 스코프가 문면에 없다

- target 위치: `spec/5-system/2-api-convention.md` `## 5. 응답 형식` → `### 5.4 부재 표현`
- 위반 규약: 문서 구조 규약(§5.4 자신의 설계 의도) — CLAUDE.md 의 "결정의 배경·근거는 spec
  문서에" 원칙과, `--impl-done` 게이트 자체가 이미 이 갭을 `11_33_21` cross_spec 코멘트로
  지목한 바 있다(아래 근거).
- 상세: §5.4 는 `## 5. 응답 형식` 의 하위 절로 **섹션 nesting 으로만** "응답 바디 전용"임을
  암시한다. 본문에는 그 scope 를 명시하는 문장이 없다. 이번 diff 가 만든
  `create-assistant-session.dto.ts` (`llmConfigId?: string | null`) 는 **요청 DTO** 인데,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 후속 체크리스트가 스스로
  기록하듯 "이 세션이 `llmConfigId`(요청 DTO) 정정을 CHANGELOG 에서 '형태는 §5.4 를 따랐다'
  라고 적었다가 되돌렸다" — 즉 **이 PR 안에서 실제로 한 번 오독이 일어났다.** §5.4 규칙은
  "키 생략 = `| null` 금지" 라고 적혀 있지만, 이는 응답 wire 전용이고 요청 DTO 의 PATCH
  tri-state(키 생략=불변, `null`=초기화, 값=설정 — `update-assistant-session.dto.ts` 가 실사례)
  는 이 규칙이 다루지 않는 별개 계약이다. 이 구분이 코드 주석·plan 에는 적혀 있지만 **spec
  본문에는 아직 반영되지 않았다.**
- 근거(직접 확인): 신규 가드 `swagger-dto-contract-guard.ts` 는 OpenAPI `nullable`/`required`
  와 TS 타입의 **정합성**만 검사하고, "요청 DTO 의 optional+nullable 조합이 §5.4 를 벗어나는가"
  는 검사하지 않는다(코드 주석 자체가 "판정은 '이 필드가 상시 존재인가' 라는 필드별 의미
  판단이라 기계화되지 않는다"고 명시) — 즉 이 스코프 갭은 **자동 가드로도 막히지 않고
  문서로만 막을 수 있는 자리**인데 아직 안 막혀 있다.
- 제안: `spec/5-system/2-api-convention.md §5.4` 본문에 "본 절은 응답 바디에 적용되며, 요청
  바디의 PATCH tri-state(키 생략=불변/`null`=초기화/값=설정)에는 적용하지 않는다" 류의 명시
  문장을 추가한다. 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속
  체크리스트에 "[ ] §5.4 에 '응답 바디 한정' 스코프 문구 (planner, `--impl-done` `11_33_21`
  cross_spec)" 로 등재돼 있으므로 **신규 지적이 아니라 기존 트래킹 항목의 재확인**이다 — 다음
  planner 턴에서 반드시 반영할 것.

### [INFO] DTO nullable/optional 축 — diff 는 규약을 정확히 따랐다 (양성 확인)

- target 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`,
  `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- 대조 규약: `spec/5-system/2-api-convention.md §5.4`, `spec/conventions/swagger.md §1-3/§1-4`
- 상세: `background-run-response.dto.ts` 의 `finishedAt`/`durationMs`/`inputData`/`outputData`/
  `error`/`nextCursor`/`completedAt` 은 전부 `T | null`(옵셔널 아님, 상시 존재)인데 종전엔
  `@ApiPropertyOptional` 을 썼다 — §5.4 가 명시적으로 금지하는 "상시 존재 필드에
  `@ApiPropertyOptional`" 패턴이었다. diff 는 이를 `@ApiProperty({ nullable: true })` 로
  정정했다 — **규약과 정확히 일치.** `create-assistant-session.dto.ts` 의 `llmConfigId` 는
  반대 방향 계약 거짓(선언은 `nullable:true` 인데 TS 는 `string`)을 `string | null` 로
  넓혀 정합화했다 — 이것도 정확하다(단, 위 WARNING 에서 지적한 스코프 문서화는 별개로 남음).
  두 수정 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 체크리스트
  1번 항목("계약 거짓 9곳")에 이미 사유·근거가 기록돼 있다.
- 제안: 없음 — 준수 확인용 기록.

### [INFO] `spec/5-system/2-api-convention.md §2.2` 신규 예외 — §5 엔드포인트 표와 정합

- target 위치: `spec/5-system/2-api-convention.md §2.2` (세 번째 예외: 인증 상태 전이·
  capability 액션) vs `§5. API 엔드포인트`
- 상세: 이번 세션에 추가된 것으로 보이는 `/api/auth/{action}` 예외 조항의 예시(`login`,
  `refresh`, `2fa/verify`, `oauth/:provider`)와 `/api/auth/workspaces/:id/switch` 를 RPC-style
  예외로 넘긴 교차참조 모두, §5 엔드포인트 표·§2.2 RPC-style 예외 목록과 실제로 일치한다.
  명명 규약 위반 없음 — 규약 신설이 실제 API 표면과 어긋나지 않게 잘 반영됐다.
- 제안: 없음 — 준수 확인용 기록.

### [INFO] repo-guards 리팩터(`toPosixRelative` 등)는 spec/conventions 대상 밖

- target 위치: `codebase/backend/src/{common/__test-utils__,repo-guards/__tests__}/*`
- 상세: 이번 diff 의 절반 이상은 내부 테스트 인프라(경로 정규화 헬퍼 추출, `swagger-dto-
  contract-guard` 신설)로, `spec/conventions/**` 가 규율하는 명명·출력 포맷·API 문서 데코레이터
  대상이 아니다(도메인 API·DTO·감사 액션·redis 키 등이 아님). 점검했으나 위반 대상 자체가
  아니라는 뜻에서 INFO 로만 기록.
- 제안: 없음.

## 요약

이번 diff 의 실질(9곳 "계약 거짓" DTO 수정 + 그것을 잡는 신규 가드)은
`spec/5-system/2-api-convention.md §5.4`·`spec/conventions/swagger.md §1-4` 가 요구하는
"`@ApiProperty`/`@ApiPropertyOptional`·`nullable`·TS `| null`/`?` 의 3축 정합"을 정확히
따르고 있으며, 위반이라 부를 CRITICAL 은 발견되지 않았다. 유일한 실질적 갭은
§5.4 의 적용 범위(응답 바디 전용)가 섹션 nesting 으로만 암시돼 있어 이번 세션 내에서 실제로
한 번 오독을 유발했다는 점인데, 이는 이미 `plan/in-progress/spec-draft-nullable-notation-
followups.md` 에 후속 planner 항목으로 정확히 등재돼 있어 "발견되지 않은 결함"이 아니라
"아직 집행되지 않은 알려진 항목"이다. spec/5-system 의 나머지 16개 파일과 다수의
`spec/conventions/cafe24-*` 카탈로그는 예산상 생략되어 이번 라운드에서 검증되지 않았다.

## 위험도

LOW

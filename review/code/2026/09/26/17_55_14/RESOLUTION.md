# RESOLUTION — `/ai-review` 1R (Critical 0 · Warning 3)

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 `bodyParamDesignType` 의 두 에러 분기가 무테스트 — `swagger-probe.spec.ts` 가 «이 헬퍼의 존재 이유는 에러 경로» 라고 적는 관례를 벗어남 | 사실. `swagger-probe.spec.ts` 에 네 케이스: 전제(첫 파라미터가 `string` 인 스텁 — 순서로 찾으면 `String` 이 나온다) · `@Body()` 부재 · `@Body()` 둘 · `design:paramtypes` 부재(데코레이터 없는 메서드에 라우트 인자 메타데이터만 손으로). 방어 분기 셋을 하나씩 빼는 뮤턴트 MX1~MX3 — 전부 KILLED, 각자 예측한 케이스가 죽였다 | `fafc6b8ac` |
| W2 캐너리 세 파일이 같은 4-테스트 틀을 반복(rule-of-three) | 조치 안 함 — 리뷰어 스스로 «5번째 유사 라우트 발생 시점에 재검토 · 즉시 차단 아님» 으로 적었다. 캐너리는 «여기가 RED 면 문서 작업이 계약 변경으로 번졌다» 를 **그 라우트 파일 안에서** 읽히게 하는 것이 목적이라(선례 `workflows-execute-body.spec.ts`), 팩토리로 접으면 실패 메시지가 어느 라우트의 계약인지 흐려진다. 반복되는 조회는 이미 헬퍼(`bodyParamDesignType`)로 뽑았다 | — |
| W3 이 PR 이 닫는 트래커 항목이 미체크 · 처방 문구가 채택하지 않은 «요청 DTO 승격» 그대로 | 마무리 커밋에서 닫는다 — 종결 노트에 채택안(«문서 전용 DTO + `@ApiBody`, 파라미터 타입은 인라인 유지»)과 그 이유(전역 파이프 진입 = 계약 변경)를 적어 다음 사람이 승격을 재시도하지 않게 한다. 전역 가드 후속 항목에 `swagger.md` §1-7 `<Domain><Action>RequestDto` 행도 함께 | 마무리 커밋 |
| INFO1 `@Body()` 가 둘 이상이면 첫 자리만 낸다 | 둘 이상이면 던진다 + 테스트 | `fafc6b8ac` |
| INFO2 헬퍼 안의 변수명 `body` | `bodyArgs` | `fafc6b8ac` |
| INFO3 Nest 내부 경로 의존 | JSDoc 에 명시 — Nest 메이저 업그레이드 때 이 헬퍼의 에러 경로 테스트가 먼저 깨진다 | `fafc6b8ac` |
| INFO4 `*RequestDto` 접미가 §1-7 에 없다 | W3 과 같이 트래커 후속 항목에 | 마무리 커밋 |
| INFO5 · 8 | 조치 불필요 — 의도된 분리 · 양호 확인 | — |
| INFO6 `newBotToken` JSDoc 에 spec 링크 | 조치 안 함 — JSDoc 은 공개 OpenAPI `description` 으로 나간다(`swagger.md` §3). spec 경로는 바로 위 `//` 주석에 이미 있다 | — |
| INFO7 «문서 전용 DTO» 근거 산문이 DTO 마다 반복 | 조치 안 함 — 각 파일의 근거는 그 라우트의 **바뀌는 계약**(rotate 는 `INVALID_BOT_TOKEN` → `VALIDATION_ERROR`, continue 는 여분 키)이 달라 한 곳으로 모으면 자리별 이유가 사라진다. 공통 원리는 선례 한 줄 인용으로 줄였다 | — |

**리뷰 중 관측(SUMMARY 머리)**: testing 리뷰어가 뮤턴트 M2 를 재현하려고 DTO 를 일시 변경했다 원복했다. 리뷰 뒤 `git status --short` 는
리뷰 산출물 디렉터리만 보였고 `.bakmut` 잔여물은 없었다(`find codebase -name '*.bakmut'` 0건). `writeOnly: true` 는 그대로다.

## TEST 결과

1R 조치 커밋 `fafc6b8ac` 기준, worktree 루트에서 1단계부터.

- lint: 통과 (`_test_logs/lint-20260926-180611.log`)
- unit: 통과 (`_test_logs/unit-20260926-180711.log`)
- build: 통과 (`_test_logs/build-20260926-180839.log`)
- e2e: 통과 — 412건 (`_test_logs/e2e-20260926-181206.log`)

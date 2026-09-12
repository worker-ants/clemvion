# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 가드 baseline-zero 설계 때문에 신고된 단일 엔드포인트 밖의 파일(`auth.controller.ts`)까지 수정됨
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:433-440`
  - 상세: 이번 배치의 원 결함은 `triggers.controller.ts`의 `rotateBotToken` 한 곳(`:id`에 `ParseUUIDPipe` 없음)이다. 그런데 `param-uuid-pipe` 가드를 "허용목록 없이 베이스라인 0"으로 두려는 설계 때문에, 가드가 새로 잡아낸 `switchWorkspace`의 `@ApiParam({format:'uuid'})` 누락까지 이 PR에서 같이 고쳤다. `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §A에 "AST로 다시 재니 문서 축 미충족이 3건이었다"로 명시적으로 근거를 남겼고, `--impl-prep` convention_compliance WARNING(같은 조항의 절반만 겨냥한다)이 이 확장을 요구했으므로 발의자 임의의 확장은 아니다. 다만 "요청된 변경(원 엔드포인트 1곳)"과 "실제 diff 범위(가드 설계상 파생된 형제 엔드포인트 수정)"가 다르다는 사실 자체는 스코프 관점에서 기록해 둘 가치가 있다.
  - 제안: 현재 수준(plan에 근거·`--impl-prep` 근거 기록)이면 충분하다. 추가 조치 불요 — 다만 리뷰 시 "1곳 수정" 기대와 "2개 컨트롤러 수정 + 신규 가드 3파일"이라는 실제 diff 크기 차이를 인지하고 판단할 것.

- **[INFO]** 원 결함(1줄 파이프 누락) 대비 훨씬 무거운 신규 정적 가드(3파일·약 300줄) 추가
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (신규, 187줄) · `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (신규, 122줄) · `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (신규, 96줄)
  - 상세: "요청하지 않은 기능 추가(over-engineering)" 관점에서 걸릴 수 있는 지점이다. 그러나 이 저장소에는 `dto-class-name-collision`·`swagger-dto-contract`·`nullable-type-lie-cast` 등 같은 클래스의 반복 결함을 AST 가드로 고정하는 확립된 관례가 이미 존재하고(파일 4 헤더 주석이 그 선례를 직접 인용), `--impl-prep` 게이트가 "이 조항을 절반만 지킨다"고 지적해 두 축 전수 가드가 필요했다는 근거도 plan에 기록돼 있다. 즉흥적 기능 확장이 아니라 저장소 컨벤션 + 리뷰 게이트 요구에 따른 설계로 보인다.
  - 제안: 스코프 위반으로 보지 않음. 다만 통합 리뷰(merge-coordinator) 단계에서 "한 줄 버그 수정 PR"로 오인해 diff 크기를 과소평가하지 않도록 참고.

- **[INFO]** 배치 주제(trigger UUID·chat-channel 가이드 코드)와 무관한 MCP 환경변수명 오기 수정이 같은 PR에 포함됨
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:39`, `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.en.mdx:28`
  - 상세: `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 정정은 트리거/챗채널과 무관한 MCP 통합 문서의 별개 결함이다. `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §B "축 1"에 따르면, 트래커가 요청한 감사 범위는 원래 "가이드가 잘못 적은 **에러 코드**"였는데 실행 과정에서 "`content/docs/**`의 UPPER_SNAKE 토큰 전체가 코드베이스에 존재하는가"로 감사 방법론 자체를 넓혔고, 그 과정에서 에러 코드가 아닌 환경변수명 오기까지 함께 발견·수정했다. 발견과 처분이 plan에 투명하게 기록돼 있고 변경 자체는 2줄짜리 저위험 오탈자 수정이라 실질적 리스크는 낮지만, "trigger-uuid-and-guide-codes"라는 배치 주제와는 직접 관련이 없는 영역(MCP 통합 문서)이 슬쩍 포함된 것은 사실이다.
  - 제안: 리스크가 낮고 근거가 투명하게 기록돼 있어 되돌릴 필요는 없어 보인다. 다만 커밋 메시지/PR 설명에 "MCP 환경변수명 오탈자 수정 포함"을 명시해, 리뷰어가 diff 범위를 예측 가능하게 할 것.

- **[INFO]** plan 문서 두 곳(`spec-draft-nullable-notation-followups.md`, 신규 `trigger-uuid-and-guide-error-codes.md`)의 대규모 편집은 실질 코드 변경이 아니라 트래커 갱신
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (체크박스 종결·새 후속 항목 3건 등재), `plan/in-progress/trigger-uuid-and-guide-error-codes.md` (신규 230줄)
  - 상세: 프로젝트 관례상(plan 라이프사이클) 작업 완료 시 트래커 체크박스 갱신과 신규 작업 plan 파일 작성은 정상적인 부수 작업이며, 코드 변경 자체와 섞여 있지 않다. 스코프 위반 아님 — 참고용으로만 기재.

## 요약

diff 16개 파일 전체가 `plan/in-progress/trigger-uuid-and-guide-error-codes.md`에 사전 기록된 계획(§A UUID 파이프+가드, §B 가이드 오류 코드 6곳+MCP 환경변수 2곳, §C 등재-only)과 1:1로 대응하며, 각 확장 지점(형제 엔드포인트 수정, 신규 가드 300줄, MCP 오탈자)마다 실측·리뷰 게이트 근거가 함께 남아 있어 "몰래 끼워 넣은 변경"은 발견되지 않았다. 다만 (1) 가드의 베이스라인-0 설계가 원 신고 대상(트리거 1곳) 밖의 `auth.controller.ts`까지 건드렸고, (2) 원 결함(1줄) 대비 신규 가드 인프라가 상당히 무겁고, (3) MCP 환경변수 오탈자 수정은 배치 주제와 직접 관련이 없는 영역이라는 점은 스코프 관점에서 기록해 둘 가치가 있다. 셋 모두 리스크는 낮고 근거가 투명하게 문서화되어 있어 차단 사유는 아니다.

## 위험도

LOW

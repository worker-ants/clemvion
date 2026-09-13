# 정식 규약 준수 검토 — `spec/5-system/` (`--impl-done`, 라운드 3)

## 검토 범위와 방법

`spec/5-system/` 델타는 이번 라운드도 0파일이다 — developer 는 spec 쓰기 권한이 없고, 필요한
spec 변경은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 백로그로
등재된 상태를 유지한다(정상, CRITICAL 근거 아님).

HEAD 는 `de99def86`("리뷰 라운드 2 — 형제 엔드포인트에도 계약 검사를 걸고, 내 JSDoc 자기모순을
고친다")이며, 이는 직전 라운드(`--impl-done` `10_41_13`, convention_compliance WARNING 2건)가
지적한 항목의 처분 커밋이다. 이번 라운드는 **그 처분이 실제로 규약을 만족시켰는지**를
`git show de99def86` 로 워킹트리(HEAD)를 절대경로 기준 직접 대조해 확인했다. `spec/conventions/
swagger.md`·`spec/conventions/user-guide-evidence.md`·`spec/conventions/error-codes.md` 전문을
`Read` 로 재대조했다.

## 발견사항 — 신규 위반 없음

라운드 2 지적 2건 모두 규약대로 처분됐음을 실측으로 확인했다.

### 1. `swagger.md §3` JSDoc/`//` 분리 — 정정 확인

`integration-response.dto.ts` 의 `TestConnectionResultDto.code` JSDoc:

```diff
-  /**
-   * 실패 분류 코드 (`MCP_*` · `EMAIL_CONNECT_FAILED` · `INTEGRATION_INCOMPLETE` 등).
-   * 성공 시 부재.
-   *
-   * **이 선언은 `latencyMs` 의 정반대 방향 결함을 닫는다** — … (경위 서술 계속)
-   */
+  // 이 선언은 `latencyMs` 의 **정반대 방향** 결함을 닫는다 — … (경위 서술, `//` 로 이동)
+  /**
+   * 실패 분류 코드. `MCP_*` · `EMAIL_CONNECT_FAILED` · `INTEGRATION_INCOMPLETE` 등이며,
+   * 성공 응답에는 실리지 않습니다.
+   */
   @ApiPropertyOptional()
   code?: string;
```

`swagger.md §3`(2026-09-05 규약화) 표의 두 축("소비자가 알아야 하는 것 → JSDoc" / "경위·리뷰
참조 → `//`")과 정확히 일치한다. `nest-cli.json` 의 `introspectComments: true` 가 스캔하는 것은
`/** */` 뿐이므로, 내부 plan 파일 경로(`plan/in-progress/spec-draft-nullable-notation-
followups.md`)를 포함한 서사가 이제 공개 OpenAPI `description` 에 노출되지 않는다. 같은 파일의
`meta` 필드 처리(`//` 전용)와도 이제 대칭이다.

부수 확인:
- `TestConnectionResultDto` / `ModelTestConnectionResultDto` 클래스명은 저장소 전체에서 유일
  (`grep -rn "export class TestConnectionResultDto\|export class ModelTestConnectionResultDto"`
  각 1건) — `swagger.md §5-1` 클래스명 유일성 요구 위반 없음.
- 신규 계약 검사(`integrations.service.spec.ts` 의 `assertMatchesContract(result,
  await contractForDto(TestConnectionResultDto))`)는 같은 헬퍼를 쓰는 기존 `llm.service.spec.ts`·
  `llm-model-config.controller.spec.ts` 호출 패턴과 동형이다 — 신규 관례 도입 아님.

### 2. `user-guide-evidence.md §2.1` 등재 범위 — 정정 확인

`spec-draft-nullable-notation-followups.md` 의 해당 백로그 항목이 "가드 **2건**이 빠져 있다
(3건 → 5건)"으로 갱신되고, `guide-error-code-existence.test.ts`·`guide-sanitized-message-
parity.test.ts` 두 가드가 무엇을 보는지 표로 병기됐다 — 라운드 2 시점 diff(신규 가드 2건 +
`impl-anchor-existence` 기존 3건 → 계 5건)와 등재 범위가 이제 일치한다. `spec/conventions/
user-guide-evidence.md` 본문은 여전히 "가드 3건"(§2 표제)으로 남아 있으나, 이는 developer 가
직접 고칠 수 없는 governance 문서(§Skill 체계 — spec/ 는 project-planner 소관)이고 정확한
갱신 요청이 planner 백로그에 대기 중이므로 규약 위반이 아니다.

## 기존 격차 — 변화 없음 (참고, 신규 조치 불요)

라운드 1 이전(`01_15_40`/`10_12_54`)에 등재된 아래 항목들은 이번 라운드로도 상태 변화가 없다 —
모두 planner 백로그에 정확히 등재된 채 열려 있다(governance 경계 준수, 위반 아님):

1. `3-error-handling.md §1` 카탈로그가 LLM 도메인 HTTP 에러 코드(`LLM_CREDENTIALS_REQUIRED`·
   `LLM_MODEL_LIST_FAILED`) 및 CAFE24/MAKESHOP/OAUTH 도메인 코드 계열을 누락.
2. `7-llm-client.md §8.3` 에 `testConnection` 실패 shape(`{success:false, message}`) 미문서화.
3. `user-guide-evidence.md §2/§2.1` 의 "3건" 표기 — 위 발견사항 2 로 등재 범위 자체는 이번
   라운드에 정정됐고, 문서 본문 갱신은 여전히 planner 턴 대기.

## 명명·API 문서 규약 관련 — 문제 없음으로 재확인

- `error-codes.md` 의 소유 범위 선언("본 문서가 유일하게 소유하는 것: 명명원칙·rename 정책·
  historical-artifact 레지스트리")과, developer 가 백로그에 남긴 "`error-codes.md` 에는 적지
  않는다"는 판단이 정확히 일치한다 — 카탈로그·트리거는 `3-error-handling.md` SoT.
- CHANGELOG.md 개정("응답 필드 2종 제거" → "두 테스트 엔드포인트의 응답 필드 정리")이 라운드 1
  범위 확장(형제 DTO 포함)을 반영해 실제 diff 와 일치하도록 재정정됐다 — 서술과 실측 간
  drift 없음.

## 요약

라운드 2 처분 커밋(`de99def86`)은 직전 라운드가 지적한 두 WARNING(swagger.md §3 JSDoc/`//`
분리 위반, user-guide-evidence.md 등재 범위가 diff 보다 좁음)을 각각 규약 문면과 정확히 일치하는
방식으로 고쳤고, 그 수정 자체가 새로운 규약 위반을 내지 않았다(클래스명 유일성·계약 검사 호출
패턴·CHANGELOG 정합 모두 기존 관례와 일치). `spec/5-system/` 델타는 여전히 0이며 기존에 열려
있던 세 항목(LLM 에러 코드 카탈로그 공백·testConnection 실패 shape 미문서·user-guide-evidence
본문 "3건" 표기)은 상태 변화 없이 planner 백로그에 정확히 등재된 채 유지된다.

## 위험도

NONE

# 문서화(Documentation) 리뷰

## 리뷰 범위 및 방법

이번 diff(`origin/main` 대비 37개 파일)는 실질적으로 두 층으로 구성된다.

- **실 변경 5개**: `CHANGELOG.md`, `codebase/backend/src/common/pipes/validation.pipe.spec.ts`(신규),
  `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`,
  `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md`.
- **이전 리뷰 라운드 산출물 32개**: `review/code/2026/09/04/18_34_04/*`,
  `review/code/2026/09/04/18_56_22/*`, `review/consistency/2026/09/04/18_51_26/*`.
  프로젝트 관례상 `review/**` 는 gitignore 대상이 아니라 커밋되는 정식 저장 위치이므로,
  이 자체는 문서화 결함이 아니다(`git diff origin/main --stat` 으로 37개 전량과 prompt 목록이
  정확히 일치함을 확인).

`Read`/`Grep`/`git log -S` 로 실 변경 5개 파일의 현재 상태와 이전 두 라운드
(`18_34_04`, `18_56_22`)의 WARNING·INFO 조치 내역을 교차 검증했다. 저장소 파일은
수정하지 않았다(`git status --short` 로 확인 — 이 리뷰가 만든 변경 없음).

## 교차검증 결과 (모두 일치, 오탐 없음)

- `spec/2-navigation/14-execution-history.md:345` — 실제로 그 줄에 "페이지네이션, 상태 필터,
  정렬" 문구가 그대로 있음(`sed -n '345p'` 로 재확인). `query-execution.dto.ts` JSDoc·
  CHANGELOG 양쪽의 줄번호 인용이 정확하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — `## 후속` 섹션의 미체크
  항목이 정확히 2개(`§5.4 drift 2단계`, `idx_schedule_next_run`)이고, `## 종결 조건` 표도
  같은 2행만 미종결로 남아 있어 **서로 일치**한다. 직전 두 라운드가 지적한 "넷" 하드코딩
  문구는 이번 diff 에서 완전히 삭제되고 "표에 개수를 적지 않는다" 는 caveat 로 대체돼,
  같은 종류의 stale 이 재발할 표면 자체가 없어졌다.
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — 현재 파일 전체가 영어로
  통일돼 있다(신규 `describe` 블록도 영어). `18_56_22` WARNING #2(신규 테스트만 한국어라
  파일 내 언어 컨벤션이 갈렸던 문제)의 수정이 실제로 반영됐다. JSDoc 의 추적 링크도
  ephemeral 리뷰 세션 ID 대신 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  §후속 을 인용해 SoT 로 향한다(`18_56_22` INFO #8 조치 반영 확인).
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — JSDoc 이
  인용하는 `[대조군] @Transform 예외` 픽스처는 `swagger-dto-contract.spec.ts:173` 에 실재하며,
  이 파일 자체는 이번 diff 에 포함되지 않는다(`git diff origin/main -- .../swagger-dto-contract.spec.ts`
  결과 없음) — 기존 재사용 가능한 픽스처를 참조한 것이지 누락이 아니다.
- CHANGELOG 의 "`Api*` 필드 1,095개 중 `@Transform` 17개, null 축 불일치 0개" 수치는
  가드 JSDoc·plan 항목 세 곳에서 동일하게 반복되며 셋 다 일치한다.

## 발견사항

- **[INFO]** CHANGELOG 에 새 회귀 테스트(`validation.pipe.spec.ts` 의
  `forbidNonWhitelisted` describe 블록) 추가 사실이 언급되지 않는다.
  - 위치: `CHANGELOG.md` (Unreleased 항목 전체, 게이트 3-41)
  - 상세: 이 테스트는 직전 라운드 WARNING("200→400 breaking change 를 고정하는 테스트가
    없다")에 대응해 신설됐다. CHANGELOG 는 API 표면 변경 서술로는 이미 충분하고 테스트
    존재를 CHANGELOG 에 싣는 것은 이 저장소의 일반적 관례도 아니라 필수 사항은 아니지만,
    "영향" 절 옆에 한 줄 추가하면 향후 이 CHANGELOG 항목만 보고 회귀 방지 커버리지 유무를
    판단하려는 사람에게 도움이 된다.
  - 제안: 조치 불요(선택 사항). 굳이 반영한다면 "영향" 절 말미에 "이 회귀는
    `validation.pipe.spec.ts` 의 `forbidNonWhitelisted` 스위트로 고정됨" 한 줄 추가.

- **[INFO]** `swagger-dto-contract-guard.ts` JSDoc 의 인용 블록(`> ...`)이 끝난 직후
  비-인용 문장("presence 축은 면제하지 않는다 — `@Transform` 은 키의 존재 여부를 바꾸지
  않는다.")이 줄바꿈으로 문장 중간이 갈린 채 이어진다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:118-120`
    (실제 파일 줄 번호, `Read` 로 확인)
  - 상세: 의미는 명확하고 오류는 아니나, `>` 인용 블록 종료 직후 인용 아닌 문장이 붙어 시각적
    전환이 다소 어색하다(순수 스타일). 판정 로직에는 영향 없음.
  - 제안: 조치 불요 — 스타일 참고 수준.

CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.

## 점검 관점별 평가

1. **독스트링/JSDoc** — `QueryExecutionDto` 클래스 JSDoc(제거 사유·근거)과
   `findSwaggerContractMismatches` 의 `@Transform` 예외 rationale JSDoc 모두 코드 변경과
   정확히 동기화됐다. 신규 테스트 파일에도 "왜 이 테스트가 필요한가" 를 설명하는 블록
   JSDoc 이 있고 추적 링크가 SoT(plan 문서)를 향한다.
2. **README 업데이트** — 신규 기능·설정 아님(죽은 쿼리 파라미터 제거). 해당 없음.
3. **API 문서** — OpenAPI 는 데코레이터 기반 런타임 생성이라 필드 제거만으로 자동 반영된다.
   `spec/2-navigation/14-execution-history.md:345` 는 애초에 이 파라미터를 약속한 적이
   없어(재확인 완료) spec 정정도 불요.
4. **주석 정확성** — 가드 파일의 예전 예시(`workflowId`)를 든 주석을 실사례 0건 상태에
   맞춰 정확히 갱신했다. 다른 곳(`swagger.md`, `2-api-convention.md` 등)에 이 필드를 여전히
   언급하는 잔존 stale 주석은 없다.
5. **인라인 주석** — 삭제 위주의 단순 diff라 복잡한 인라인 주석 필요 지점 없음. 클래스
   JSDoc 이 "왜 없는가"를 충분히 설명한다.
6. **변경 이력** — CHANGELOG 항목이 영향·근거·부수효과까지 상세히 기록됐고, 회귀 테스트
   추가 사실만 선택적으로 누락(위 INFO).
7. **설정 문서** — 신규 env/설정 없음. 해당 없음.
8. **예제 코드** — 별도 사용 예제 불요. CHANGELOG "영향" 절이 그 역할을 대신한다.

## 요약

실 변경분(DTO 필드 제거·신규 회귀 테스트·가드 JSDoc 갱신·CHANGELOG·plan 트래커)은 두 차례
선행 리뷰(`18_34_04`, `18_56_22`)에서 이미 documentation 관점 NONE 으로 판정됐고, 이번
독립 재검증에서도 spec 줄번호 인용, plan 체크박스/표 정합, 테스트 파일 언어 통일, JSDoc
추적 링크의 SoT 지향 등 핵심 주장을 전부 `Read`/`Grep` 실측으로 재확인해 일치했다 — 새로
발견된 결함은 없다. 이번 커밋에 함께 포함된 32개 리뷰/일관성 산출물은 `review/**` 가 정식
저장 위치라는 프로젝트 관례에 부합하며 문서화 문제로 볼 수 없다. 남는 것은 CHANGELOG 에
신규 회귀 테스트 존재를 언급하지 않은 점과 JSDoc 인용 블록의 사소한 시각적 전환 정도로,
둘 다 조치 불요 수준의 INFO다.

## 위험도

NONE

# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `schedule-trigger.e2e-spec.ts` 파일 최상단 "검증 대상" 목록이 이번에 추가된 `TriggerDto.workflow` 양성 단언 3곳을 반영하지 않음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (파일 헤더 JSDoc, 줄 16~28 — 게이트 없는 문맥 줄이라 실제 파일을 `Read` 로 확인) / 신규 단언은 게이트 270~278·390~393·427~430
  - 상세: 파일 헤더의 `## 검증 대상` bullet 목록(cron preview·자동 trigger 생성·PATCH 재계산·run-now·delete·비활성 동기화·목록 정렬·V110 인덱스)에는 이번에 추가된 "`TriggerDto.workflow` 가 목록/PATCH 응답에서 채워지는지" 축이 빠져 있다. 인라인 주석(각 단언 바로 위)은 근거가 충분하지만, 파일을 훑어보는 사람이 헤더만 보고 "이 파일이 무엇을 고정하는가"를 판단하면 이 신규 축을 놓친다. 형제 파일 `trigger-workflow-ref.e2e-spec.ts` 는 반대로 헤더에 "경로 전수" 표까지 갖춰 대비된다.
  - 제안: 헤더 bullet 목록에 한 줄 추가 — 예: "목록(C-2)·PATCH(G·H) 응답의 `TriggerDto.workflow` 관계 양성 고정(`expectTriggerWorkflowRef`)".

- **[INFO]** `plan/in-progress/trigger-canary-hardening.md` 의 "`grep '가드 [0-9]'` **9자리** 전부 검색됨" 수치가 실측과 정확히 맞는지 재확인 필요
  - 위치: `plan/in-progress/trigger-canary-hardening.md:167` (체크리스트 "3 — 캐너리 주석 정리" 항목)
  - 상세: 실제로 `grep -n '가드 [0-9]' codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` 를 돌리면 구조적 위치 표시(케이스 코멘트·헤딩) 기준으로 1·2·3·4(결합)·3·5(결합, 옛 `③·⑤`)·6·7·8·9·10·11 = **10개** 지점이 걸린다(본문 산문 인용 3곳은 별개). "9자리"라는 숫자가 어떤 집합을 센 것인지 plan 본문에 정의돼 있지 않아, 다음 사람이 재현하면 개수가 어긋나 보일 수 있다. 이 프로젝트 관례상("실측했다"는 검증 가능한 주장이어야 한다) 세는 기준(예: 헤딩만 vs 코멘트+헤딩)을 한 문장 명시하거나 숫자를 재검산하는 것이 안전하다. 확신도는 낮음 — 지적 자체(옛 `③·⑤` 케이스가 grep 에서 빠졌었다는 핵심 주장)는 실제로 정확함을 확인했다.
  - 제안: "9자리"가 정확히 무엇을 가리키는지(코멘트만/헤딩만/합계) 괄호로 명시하거나, `grep -n` 출력 라인 수로 재검산.

- **[INFO]** CHANGELOG 미갱신은 문제 없음 — 확인만 기록
  - 위치: `CHANGELOG.md` (루트)
  - 상세: 이번 변경은 순수 내부 테스트/가드 하드닝이며 `spec_impact: none`, 사용자 관측 가능한 동작 변경이 없다. `CHANGELOG.md` 의 기존 항목들은 모두 "Behavior change"·가이드 문구 수정 등 사용자/타 세션에 보이는 변경만 기록하는 관례로 보여, 이번 PR 에 대한 신규 CHANGELOG 항목은 불필요하다고 판단된다(누락이 아님).

## 검증한 사항 (문제 없음)

- `trigger-secret-columns-guard.ts` / `trigger-secret-columns.spec.ts`: 신설 함수(`readStringArrayConst`, `readAllTriggerSecretColumnLists`) 모두 JSDoc 완비. `null` vs `[]` 구분, AST-말고-정규식 안 쓰는 이유, `satisfies`/`as`/괄호 언랩 필요성이 전부 예시·근거와 함께 문서화됨. `CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST` 가 실제 소스 3곳의 상수명·비-export 여부와 정확히 일치함을 직접 열람으로 확인(`triggers.service.ts:104`, `schedule-trigger-ref.ts:24`, `trigger-workflow-ref.ts:45`).
- 인용된 선례(`redis-fail-open-catalog-guard.ts` 의 "가드가 자기 오판을 사실로 굳힌다" 문구, `masked-reject-callers-guard.ts` 의 guard/spec 분리 규약, `CREATOR_PROJECTION` 4중 복사 이력)를 모두 실제 소스에서 대조 확인 — 지어낸 근거 없음.
- `trigger-workflow-ref.spec.ts` 의 표기 통일 diff: 헤더의 "가드는 11개" 목록과 아래 케이스 마커(`// ── 가드 N ──`, `## 가드 N`)의 번호가 서로 어긋나지 않음을 실측(1~11 전 구간 확인). 리뷰 이력 서술(4문단) 제거 후에도 "새 가드는 그 자리에 테스트도" 규칙과 가드 5 의 "진단 품질" 근거는 남겨 dead-code 오인 위험을 스스로 방지한 점이 좋음. `"keys [] ≠ ['id','name']"` 을 의역으로 명시한 것도 정확성 개선.
- `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` JSDoc 개정: "미검증"→"두 경계에서 실측"으로 승격하면서 `secret-store.md §R4` 가 규율하는 대상(프로덕션 삭제 경로)과 이 판단의 대상(테스트 인프라 한정)을 명시적으로 갈라 확산 위험을 막음 — `chat-channel-trigger-create.e2e-spec.ts` 의 새 주석이 이 파일을 "정본"으로 지목하고 중복 서술을 피한 것도 일관됨(양쪽 다 실제로 `secret_store` row 를 만드는 파일임을 확인).
- `schedule-trigger.e2e-spec.ts` 신규 인라인 주석(C-2·G·H)이 실제 케이스 라벨(`it('C-2. ...')`, `it('G. ...')`, `it('H. ...')`, `it('C-3. ...')`)과 정확히 대응함을 확인.
- plan 문서(`trigger-canary-hardening.md`, `spec-draft-nullable-notation-followups.md`) 는 "9건/12건 GREEN" 등 테스트 개수 주장을 실제 `it()` 개수와 대조해 정확함을 확인(guard spec 9개, workflow-ref self-spec 12개).
- README/API 문서: 이번 변경은 API 표면·환경변수·설정을 추가하지 않았고, 저장소에 repo-guard 목록을 미러링하는 README/인덱스 파일이 원래 없어(다른 26개 기존 guard 도 동일) README 업데이트 대상 아님.

## 요약

문서화 품질은 전반적으로 높다 — 신설 가드·spec 파일은 함수 단위 JSDoc, 설계 근거(정규식 대신 AST, `null`/`[]` 구분, 래퍼 언랩), 뮤테이션 실측 결과를 모두 갖췄고, 인용된 선례·형제 파일 근거를 실제 소스와 대조한 결과 오류가 없었다. 캐너리 두 e2e 주석 개정(비밀 컬럼 유출 무해성 재검증, 표기 통일)도 "미검증→검증됨" 승격의 범위(테스트 인프라 한정)를 명시해 확산 오독을 예방했다. 발견된 항목은 모두 INFO 수준으로 — `schedule-trigger.e2e-spec.ts` 파일 헤더 목록이 신규 단언 축 하나를 안 담고 있는 점, plan 의 "9자리" 카운트 정의가 불명확한 점 — 둘 다 코드 정확성이나 차단 사유와 무관한 사소한 보완 여지다. CHANGELOG 미갱신은 이번 변경 성격(내부 테스트 하드닝, spec_impact none)에 부합해 문제 없다고 판단.

## 위험도

LOW

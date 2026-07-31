# 변경 범위(Scope) 검토 — 워크플로우 duplicate nodes/edges 복사 fix

## 검토 방법

`git diff --stat origin/main...HEAD` 로 prompt 번들(23개 파일)이 실제 diff 전체와 정확히 일치함을
확인했고(생략·누락 없음), 4개 커밋(`f71839fe6`→`0502e43c7`→`13b818ec5`→`539bbf7fd`) 각각을
`git show --stat`/`git show <file>` 로 개별 대조해 커밋 단위 응집도까지 확인했다.

## 발견사항

- **[INFO]** 신규 주석의 자기참조 위치가 실제로는 다른 파일을 가리킴
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-264`
  - 상세: `duplicate()` 에 추가된 주석 "manager.insert 는 @BeforeInsert hook·cascade 를 건너뛴다 —
    Node/Edge 엔티티에는 둘 다 없음(같은 전제를 고정하는 가드 테스트가 **본 파일 하단**에 있다)."
    에서 "본 파일"은 이 주석이 위치한 `workflows.service.ts` 자신을 가리키는 것으로 읽히지만, 실제
    가드 테스트(`describe('importWorkflow 전제 — Node/Edge 엔티티 @BeforeInsert 부재·cascade
    메타데이터 가드 (W3c)', …)`)는 `workflows.service.ts` 가 아니라 형제 파일
    `workflows.service.spec.ts:2222` 에 있다(`workflows.service.ts` 는 소스 파일이라 애초에
    `describe`/`it` 블록을 가질 수 없다). 가드 테스트 자체는 실재하고 주장 내용도 사실이므로
    "범위 밖 변경"이나 "근거 없는 주석 추가"는 아니며, 순수하게 자기참조 표현("본 파일")의 정밀도
    문제다. Scope 관점의 실질적 위반은 아니라고 판단해 등급을 INFO 로 유지한다.
  - 제안: "본 파일 하단" → "`workflows.service.spec.ts` 의 W3c 가드" 등으로 구체화하면 향후 독자가
    헤매지 않는다. 이번 fix 의 머지를 막을 사유는 아니다.

## 점검 관점별 확인 내역

1. **의도 이상의 변경** — 없음. `plan/in-progress/workflow-duplicate-nodes-edges.md` 의 "## 2. 구현
   계획" 체크리스트 각 항목(`duplicate()` 트랜잭션 재구현, `@ApiOperation` description 갱신, unit
   11건, e2e C 케이스 보강, spec §1.1~§1.4 반영)이 실제 diff 와 1:1로 대응하며, 체크되지 않은 두 항목
   (`/ai-review` fix, `--impl-done` consistency-check)은 실제로 아직 수행되지 않았다(현재 이 리뷰가
   그 절차 중 하나). `duplicate()` 바깥의 다른 메서드(`exportWorkflow`/`importWorkflow`/`findById` 등)
   는 diff hunk 자체가 존재하지 않아 손대지 않았음을 라인 단위로 확인했다.
2. **불필요한 리팩토링** — 없음. `workflows.service.spec.ts` 의 diff hunk 는 import 1줄 + `describe('duplicate', …)`
   블록 내부(구 379-548줄 구간) 2개 hunk 뿐이며, `saveCanvas` 등 인접 describe 블록은 컨텍스트로만
   등장하고 실제 변경이 없다. 기존 테스트("should create a copy…")에서 인라인 mock 을 제거하고 공유
   `beforeEach` 로 옮긴 것도 같은 `describe` 블록 안에서 신규 테스트들과 fixture 를 공유하기 위한
   필연적 변경이지 무관한 정리가 아니다.
3. **기능 확장(over-engineering)** — 없음. 트랜잭션 경계·UUID 사전 발급·고아 엣지 skip 은 plan 이
   명시한 "`importWorkflow()` 와 같은 패턴 재사용"의 직접 구현이며, trigger/workflow_test_dataset/
   실행 이력/버전 이력은 plan·spec 이 명시한 대로 의도적으로 손대지 않았다(신규 기능 추가 없음).
4. **무관한 수정** — 없음. `git diff --stat origin/main...HEAD` 결과 23개 파일 전부가 prompt 번들과
   정확히 일치하며, 이 중 코드 4개(controller/service/service.spec/e2e-spec)는 duplicate 표면에만
   국한, spec 2개는 plan 의 TO-BE 문구 그대로 반영, plan 1개는 신규 작업 문서, 나머지 16개는
   CLAUDE.md 가 강제하는 `--spec`/`--impl-prep` consistency-check 산출물(2회분)이다 — 이 저장소의
   SDD 워크플로 표준 절차 산출물이며 임의 추가가 아니다. 설정 파일(`package.json`/`tsconfig`/lint
   설정 등) 변경은 전무.
5. **포맷팅 변경** — 실질 변경과 섞인 순수 포맷팅 변경 없음. `randomUUID`/`Node`/`Edge`/
   `QueryDeepPartialEntity`/`dataSource` 는 모두 이 fix 이전부터 `workflows.service.ts` 상단에 이미
   import·주입돼 있던 것을 확인했다(`importWorkflow()` 가 이미 사용 중) — 이번 diff 의 import 구간에
   변경이 없는 것과 일치.
6. **주석 변경** — 위 INFO 1건 제외 전부 해당 diff 라인이 설명하는 로직에 밀착. 과다하게 장황하다는
   인상은 있으나(`duplicate()` JSDoc 9줄 + 트랜잭션 본문 내 인라인 주석 다수), `importWorkflow()` 등
   같은 파일의 기존 주석 밀도와 일치하는 저장소 관례이며 이번 diff 가 새로 만든 스타일이 아니다.
7. **임포트 변경** — `workflows.service.spec.ts` 의 `Edge` → `Edge, EdgeType` 변경은 새로 추가된
   테스트에서 `EdgeType.DATA`/`EdgeType.ERROR` 로 실제 사용됨을 확인(미사용 임포트 아님).
   `workflow-crud.e2e-spec.ts` 의 `randomUUID` 신규 import 도 같은 테스트 케이스 안에서 5회 사용.
   `workflows.service.ts` 는 임포트 변경 자체가 없음.
8. **설정 변경** — 없음. `package.json`/CI/lint/tsconfig 등 설정 파일은 diff 대상에 포함되지 않았다.

## 커밋 단위 응집도 (참고)

- `f71839fe6` — spec 초안 + plan 문서 + `--spec` consistency-check 산출물만
- `0502e43c7` — impl-prep 게이트 지적 반영(spec 미세 정정) + `--impl-prep` consistency-check 산출물만
- `13b818ec5` — 실제 구현 4개 코드 파일(controller/service/service.spec/e2e-spec)만
- `539bbf7fd` — e2e UUID 좌표 버그 수정 + plan 체크리스트 갱신만

역할 경계가 커밋 단위로도 깨끗하게 분리돼 있어, 리뷰 대상 diff 전체를 통틀어 "의도 밖 변경"으로
분류할 항목을 찾지 못했다.

## 요약

`plan/in-progress/workflow-duplicate-nodes-edges.md` 가 선언한 범위(트랜잭션화된 `duplicate()` 재구현
+ UUID 재매핑, 그에 대응하는 unit/e2e 커버리지, `@ApiOperation` 문서 갱신, 2개 spec 문서의 계약 정정)와
실제 diff 가 파일·라인 단위로 정확히 일치한다. `git diff --stat` 로 23개 변경 파일 전체가 prompt 번들과
일치함을 확인했고, `duplicate()` 이외 메서드·무관한 describe 블록·설정 파일·미사용 임포트·디버그
구문(`console.*`/`TODO`/`.skip`)은 전혀 발견되지 않았다. `review/consistency/**` 산출물과 plan 문서는
CLAUDE.md 가 명시적으로 의무화한 SDD 프로세스 부산물이므로 범위 이탈이 아니다. 유일한 관찰은 신규
주석 1곳의 자기참조 표현 정밀도(INFO)뿐이며, 이는 근거 없는 주장도 무관한 변경도 아니다.

## 위험도

NONE

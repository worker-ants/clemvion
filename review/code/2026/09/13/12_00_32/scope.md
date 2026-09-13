# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main --stat` 전수 확인 결과 총 138개 변경 파일, 10,601줄 추가·64줄 삭제.
그중 **113개(≈9,100줄)는 `review/code/**`·`review/consistency/**` 하위의 리뷰 라운드
산출물**(4라운드치 RESOLUTION/SUMMARY/카테고리별 리포트/meta.json)이다. 이 저장소의 워크플로
규약(`CLAUDE.md` 코드 리뷰 산출물 저장 규칙 + `plan/in-progress/guide-error-code-truth.md`
§G~§J 가 명시하는 라운드별 처분 이력)상 이 산출물들은 구현이 끝난 뒤 강제 리뷰 단계가 만들어
커밋하는 것이 정상 흐름이며, 실질 코드 변경과 무관한 "무관한 파일 수정"이 아니다. 남은
**25개 파일(1,501줄 추가·64줄 삭제)** 이 실제 스코프 판단 대상이다:

```
CHANGELOG.md · PROJECT.md
codebase/backend/.../integration-response.dto.ts, integrations.service.spec.ts
codebase/backend/.../llm-model-config.controller.spec.ts, llm.service.spec.ts, llm.service.ts
codebase/backend/.../model-config-response.dto.ts
codebase/frontend/.../model-config-manager.test.tsx
codebase/frontend/content/docs/{02-nodes/integrations{,.en}.mdx,
  05-run-and-debug/{error-handling,run-results}{,.en}.mdx,
  06-integrations-and-config/models{,.en}.mdx}
codebase/frontend/.../model-configs.ts, model-configs.test.ts
codebase/frontend/.../guide-error-code-existence.test.ts (신규)
codebase/frontend/.../guide-error-code-scan.ts (신규)
codebase/frontend/.../guide-sanitized-message-parity.test.ts (신규)
codebase/frontend/.../impl-anchor-existence.test.ts (주석만)
plan/in-progress/guide-error-code-truth.md (신규, 이 배치의 plan)
plan/in-progress/spec-draft-nullable-notation-followups.md (체크박스 1건 + 백로그 등재 8건)
```

`plan/in-progress/guide-error-code-truth.md` 를 정독해 원 티켓 범위와 실제 변경을 대조했다.

## 발견사항

- **[INFO]** 원 티켓("유저 가이드가 존재하지 않는 에러 코드 5종을 이름으로 적는다")은 **문서
  정정**으로 시작했지만, 실제 diff 는 `POST /api/model-configs/:id/test` 응답 필드
  `error`→`message` 리네임(런타임 동작 변경) + 두 DTO 의 `latencyMs`/`meta` 필드 제거 + 형제
  DTO 에 `code` 필드 추가까지 확장됐다.
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` 반환 shape),
    `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  - 상세: `plan/in-progress/guide-error-code-truth.md` §A 가 이 확장의 근거를 명시한다 —
    가이드 표를 실측하다가 "표가 틀렸다"가 아니라 "이 엔드포인트는 애초에 코드를 안 내고,
    실패 사유 문장조차 3층 필드명 불일치로 화면에 전혀 도달하지 않는다"는 **런타임 결함**을
    발견했다는 것이다. `CHANGELOG.md` 도 "⚠️ 배포 시 확인 — 응답 필드 변경(두 엔드포인트)"
    절로 이 확장을 명시적으로 고지한다. 즉 스코프 확장이 은폐되지 않았고, 원인 규명 과정에서
    드러난 근본 결함을 문서 수정만으로 덮지 않고 고친 것이라 "의도 이상의 변경"으로 보기보다는
    "조사 중 발견한 근본 원인 수정"에 가깝다.
  - 제안: 이미 CHANGELOG·plan 양쪽에 충분히 disclosure 됐으므로 추가 조치 불요. 다만
    스코프가 "문서 진위 검증"에서 "API 계약 변경"으로 넘어간 만큼, 향후 유사 사례에서는 plan
    제목·트래커 항목을 조기에 분리 등재하는 편이 리뷰 추적에는 더 유리했을 것(현재도
    plan 안에서 §A/§B/§C/§D 로 하위 구획은 돼 있어 실무상 문제는 없음).

- **[INFO]** 신규 회귀 가드 테스트 2종(`guide-error-code-existence.test.ts`,
  `guide-error-code-scan.ts`, 합계 373줄) 추가는 "에러 코드 이름 5종 정정"이라는 원 요청보다
  범위가 넓은 **인프라 신설**이다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`,
    `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (둘 다 신규 파일)
  - 상세: plan §D 가 이 결정을 `spec/conventions/user-guide-evidence.md` 의 기존 "가이드가
    거짓말 안 하는지" 가드 가족에 합류시키는 것으로 근거를 대고, `--impl-prep` 컨설턴시
    체크(WARNING#4·#5)가 위치·중복 여부까지 검증했다. 같은 디렉터리에 이미
    `impl-anchor-existence.test.ts` 등 동일 패턴의 자매 가드가 존재해 "돌출된 새 기능"이
    아니라 기존 컨벤션의 표면 확장이다. `PROJECT.md` 2줄 추가도 이 신규 가드를 가드 카탈로그에
    등재하는 절차적 반영이다. Over-engineering 으로 보기는 어렵다.
  - 제안: 없음(과잉 확장 아님, 규약 준수 확인됨).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 원 항목 체크
  1건 외에 **새 백로그 항목 8건**이 함께 등재됐다(카탈로그 누락, MCP 필드 미선언, 유령 필드
  가드 부재, `existence`≠`emission` 가드 한계, `CONTAINER_MISSING/MULTIPLE_EMIT` 선재 등).
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 전체)
  - 상세: 이는 이번 배치가 "발견했지만 지금 고치지 않기로 한" 항목들을 실제 코드 변경 없이
    트래커에만 남긴 것이라, **스코프를 넓히는 것이 아니라 오히려 좁게 유지하기 위한 장치**다
    (developer 가 spec 편집 권한 밖인 항목, 또는 별도 설계가 필요한 항목을 이번 PR 에서
    구현하지 않고 등재만 함). 프로젝트 컨벤션(백로그 등재 관행)과 일치한다.
  - 제안: 없음.

- **[INFO]** `impl-anchor-existence.test.ts` 는 코드 변경이 없고 **주석만** 정정됐다
  (`api-endpoint` 실사례가 "아직 없다"던 문구가 이 PR 이 `models{,.en}.mdx` 에 해당 앵커를
  실으면서 낡아 정정).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts`
  - 상세: 이 PR 자신이 만든 사실(신규 `<ImplAnchor kind="api-endpoint">` 도입)로 인해 직접
    낡아진 주석을 정정한 것이라 "무관한 리팩토링"이 아니라 이 PR 의 부작용을 직접 수습한
    것이다.
  - 제안: 없음.

- **[INFO]** MDX 문서 6종(`error-handling{,.en}.mdx`, `run-results{,.en}.mdx`) 수정이 원
  대상(`NODE_EXECUTION_FAILED` 단일 치환)보다 넓게, 노드 종류별 코드표 신설 + 5종 코드 추가
  + `nodeName`→`nodeLabel` 정정까지 포함한다.
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results{,.en}.mdx`
  - 상세: plan §B·§I(라운드 3) 가 근거를 댄다 — 은퇴한 대표 코드를 지우면서 spec
    §1.4 카탈로그 대비 실재 코드 5종(그중 2종은 SSRF 방어 코드)을 처음엔 빠뜨렸다가 리뷰가
    지적해 보강했고, `nodeName`→`nodeLabel` 은 "바로 옆 필드를 고치다 지나친" spec 이미
    정정된 필드명을 뒤늦게 반영한 것으로 이 PR 이 만든 오류가 아니라 이 PR 이 같은 표를
    만지는 김에 발견해 고친 기존 drift 다. 확장이지만 "요청 이상의 기능 추가"가 아니라
    "동일 표를 정확하게 만들기 위한 자연스러운 부수 보정"으로 판단된다.
  - 제안: 없음.

## 요약

실질 변경분(25파일, 1,501줄)은 원 티켓("유저 가이드 에러 코드 5종 정정")에서 출발해 조사
과정에서 드러난 런타임 계약 결함(필드명 3층 불일치)까지 고치는 방향으로 스코프가 확장됐으나,
그 확장 전부가 `CHANGELOG.md`·`plan/in-progress/guide-error-code-truth.md` 에 근거·범위와
함께 명시적으로 disclosure 돼 있고, 4라운드에 걸친 자체 code-review·consistency-check 가
스코프 확장 자체를 반복 검증했다(라운드 2 가 CHANGELOG 제목을 "필드 2종 제거"에서 두
엔드포인트로 갈라 정정한 것이 대표 사례). 은닉된 무관 수정·의미 없는 포맷팅·불필요한 주석/임포트
정리·의도치 않은 설정 변경은 발견되지 않았다. 신규 가드 테스트 2종은 기존 컨벤션(가드 가족)의
연장이라 over-engineering 으로 보기 어렵다. 138개 파일 중 113개(review 산출물)는 이 저장소의
강제 리뷰 워크플로가 만드는 정상 산출물이라 스코프 위반 판단 대상이 아니다. 전반적으로 스코프
관리가 이례적으로 꼼꼼하다.

## 위험도

LOW

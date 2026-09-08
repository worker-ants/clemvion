# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[INFO]** `production-build-devdep.spec.ts` 파일 최상단(describe 레벨) JSDoc이 세 번째 exclude 축(`__test-utils__`) 추가 이력을 요약하지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` — 신규 `it.each(...)('%s 는 빌드 대상이 아니다', ...)` 블록 바로 위 JSDoc은 "같은 형태가 세 번 반복됐다"고 정확히 적고 있으나, 이 값이 파일 최상단 describe 레벨 JSDoc에는 아직 반영되지 않았다(파일 헤더 자체 확인 필요 시 `Read` 권장).
  - 상세: 개별 테스트 블록의 JSDoc은 자기 완결적으로 정확하고 `tsconfig.build.json`의 병렬 주석과도 교차 검증 결과 일치한다. 다만 파일을 처음 여는 사람이 헤더만 읽으면 이 스위트가 반복적으로 같은 회귀 형태(devDependency 격리 exclude 누락)를 잡아 온 누적 이력을 바로 파악하기 어렵다. 이는 이전 리뷰 라운드(`review/code/2026/09/08/12_53_08` documentation INFO)에서도 동일하게 지적된 사항으로, 이번 배치에서 조치되지 않고 남아 있다.
  - 제안: 필수 수정 아님. 다음에 이 파일을 편집할 기회에 파일 헤더에 "지금까지 3회 반복된 패턴(`repo-guards`→`shared/testing`→`__test-utils__`)"이라는 한 줄을 추가하면 충분하다.

## 검증 노트 (뮤테이션 없음, read-only 대조)

이번 배치(B-1~B-8)에서 실제로 실측·대조한 항목:

- `CHANGELOG.md` — 이전 라운드(`12_53_08`)에서 지적된 "B-3/B-4 미기록" WARNING이 이번 diff에서 두 개 항목(전역 예외 필터 raw 표면 fallback + `listMembers` 투영)으로 해소됨을 확인. 링크 `[데이터 모델 ## Rationale](spec/1-data-model.md)`가 실제로 해당 heading에 착지함을 확인.
- `PROJECT.md`와 `.claude/test-stages.sh`의 `_cmd_typecheck_ratchets()` 관련 서술이 서로 사실관계(대상 tsconfig, `#1292`, TS2739, 두 스크립트 공유 코어)에서 어긋나지 않음을 확인.
- `scripts/check-backend-typecheck-ratchet.py:57`의 `tsconfig="tsconfig.json"` 실측 확인 — plan(`auth-guard-reflection-hardening.md`)의 인용과 일치.
- `spec/5-system/3-error-handling.md` §1.10의 표(`RESOURCE_CONFLICT`/409, `details.field='endpoint_path'`, `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'`)가 신규 e2e(`webhook-trigger.e2e-spec.ts` B4)의 단언과 정확히 일치함을 확인.
- `scripts/backend-typecheck-baseline.json`(total 197 / files 36)·`scripts/frontend-typecheck-baseline.json`(total 52 / files 15)이 plan 체크리스트가 기재한 실측치와 정확히 일치함을 확인.
- 백엔드 `WorkflowVersionDetailProjection` 개명 후 구파일명 `WorkflowVersionDetail`의 backend 내 잔존 참조가 없음(`grep` 전수 확인) — 프런트엔드 미러 주석도 새 이름을 정확히 인용.
- `tsconfig.build.json`의 `**/__test-utils__/**` exclude가 실제로 두 디렉터리(`common/__test-utils__`, `modules/integrations/__test-utils__`)의 non-spec 파일 5개(`source-scan.ts`·`workspace-id-fixtures.ts`·`temp-fixture.ts`·`oauth-config-mock.ts`·`make-fake-jwt.ts`)를 커버함을 확인 — 주석의 "실측 5파일" 서술과 일치.
- `workspace-id-fixtures.ts`·`oauth-config-mock.ts`·`source-scan.ts` 세 파일의 "build tsc 가 컴파일한다" 낡은 전제가 취소선+정정 형식으로 동일하게 갱신됨을 확인(자기-반증형 소정정 — CLAUDE.md 예외 요건과 부합: 이전 developer가 쓴 예고 문장을 실측으로 반증, 취소선 보존, plan에 근거 기록).

## 요약

이번 배치는 이 저장소의 매우 높은 문서화 밀도 관례를 그대로 유지하며, 이전 라운드(`12_53_08`)가 지적한 유일한 문서화 결함(CHANGELOG 미기록)이 최종 diff에서 해소된 것을 직접 대조로 확인했다. 신규 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture), 타입 개명(`WorkflowVersionDetailProjection`), DB 투영 전환(`listMembers`), `pg-error.ts` SoT 통합, 세 typecheck ratchet 관련 파일의 자기-반증형 정정 모두 "왜"를 설명하는 JSDoc/인라인 주석이 동반되었고, 교차 참조(백엔드↔프런트엔드 타입 주석, `1-data-model.md §2.1.1`·`## Rationale` 링크, `3-error-handling.md §1.10` 표, 스크립트 줄 번호 인용, baseline 실측치)를 직접 열어 대조한 결과 전부 정확했다. 유일하게 남은 것은 `production-build-devdep.spec.ts` 파일 헤더 레벨 JSDoc이 세 번째 exclude 축 추가 이력을 아직 요약하지 않는다는 INFO 수준의 잔여 사항(이전 라운드부터 지속)뿐이다. README·API 문서·환경변수 설정 문서·예제 코드 관점에서는 새 공개 API 표면·설정 옵션 변경이 없어 추가 갱신 필요성이 없다.

## 위험도

NONE

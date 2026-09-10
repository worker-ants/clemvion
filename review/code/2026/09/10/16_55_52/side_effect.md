# 부작용(Side Effect) 리뷰 — 4라운드

대상 커밋: `cfd195fb4` (`git diff HEAD~1 HEAD -- codebase/`)
리뷰 대상 `codebase/` 델타: 2파일 — `trigger-workflow-ref.ts` · `trigger-workflow-ref.spec.ts`. 둘 다
주석·라벨(가드 번호) 전용 변경이며 실행 코드 라인은 변경 없음 (`e2e-spec.ts` 는 이번 라운드 diff 에
없음 — 3라운드까지의 변경).

## 검증 절차

1. `git diff HEAD~1 HEAD -- codebase/` 로 실제 변경분을 직접 확인 (프롬프트 diff 는 파일 1 이 생략돼 있어
   원본을 열었다).
2. `it(...)` 호출 라인만 골라 diff 대조 — 추가/삭제 라인 0건.
3. 추가된 주석 텍스트에 조기 종료를 유발할 `*/` 리터럴이 섞였는지 grep — 0건.
4. `npx eslint <두 파일>` 직접 실행 (exit 0, 출력 없음) + `--print-config` 로 파일이 ignore 목록에
   걸리지 않음을 확인(`eslint.config.mjs` 만 ignore).
5. harness(`.claude/tools/**`)에 주석 형태(`//` vs `/** */`)·orphan JSDoc·테스트 라벨을 파싱하는
   스크립트가 있는지 grep — 없음 (기존 등재 사각지대는 `production-build-devdep-guard`·`secret_store`
   관례뿐이며 이번 델타와 무관, 재지적하지 않음).

## 점검 관점별 결과

1. **의도치 않은 상태 변경**: 해당 없음 — 변경분은 comment 텍스트/comment 라벨 숫자뿐.
2. **전역 변수**: 없음. `TRIGGER_SECRET_COLUMNS`·`WORKFLOW_REF_KEYS` 등 기존 모듈 상수는 이번 델타에서
   값·구조 변경 없음(주석만 갱신).
3. **파일시스템 부작용**: 없음. e2e teardown(`secret_store` 등)도 이번 델타 파일에 없음.
4. **시그니처 변경**: 없음. `expectTriggerWorkflowRef` 시그니처는 이번 델타에서 미변경(이전 라운드에서
   `expectedWorkflowId?` 추가는 이미 반영·리뷰됨).
5. **인터페이스 변경**: 없음.
6. **환경 변수**: 없음.
7. **네트워크 호출**: 없음.
8. **이벤트/콜백**: 없음.

## 지시된 초점 3항목에 대한 답

1. **`it()` 라벨 문자열 불변 여부**: 확인됨 — `git diff` 에서 `it(` 를 포함한 라인은 추가/삭제 어느 쪽에도
   나타나지 않는다(전부 컨텍스트 라인). 바뀐 것은 `it()` *위의* `// ── 가드 N: ... ──` 구분 주석과
   `/** */` JSDoc 서술뿐이다. 저장소 전체에 `testNamePattern`·`--testPathPattern`·`-t` 류 CI 필터가
   없음을 grep 으로 확인(`package.json` test 스크립트는 `jest`/`jest --config ./test/jest-e2e.json` 뿐,
   `run-test.sh` 에도 이름 기반 필터 없음) — 라벨을 참조해 테스트를 고르는 장치 자체가 존재하지 않으므로
   설사 라벨이 바뀌었어도 영향이 없었을 것이고, 실제로는 라벨도 안 바뀌었다.
2. **원문자(①~⑪)·JSDoc 블록이 기존 결론("`//` vs `/** */` 구분하는 도구 없음")에 그대로 해당하는지**:
   그렇다. `npx eslint` 를 두 파일에 직접 돌려 exit 0/출력 없음을 확인했고, 원문자가 포함된 JSDoc 블록에
   조기 종료 문자열(`*/`)이 섞여 있지 않음을 grep 으로 확인했다. harness 쪽에도 주석 형태나 유니코드
   원문자를 대상으로 하는 파서·lint 스크립트가 없다(`.claude/tools/**` grep 결과 "orphan" 언급은 모두
   프로세스/plan 문맥이지 코드 주석 문맥이 아님).
3. **재지적 금지 항목**: `production-build-devdep-guard` 가 import 도달을 못 보는 사각지대와
   `secret_store` teardown 관례는 이미 트래커(`plan/in-progress/harness-review-gate-followups.md` 및
   RESOLUTION.md 기록)에 등재돼 있으며, 이번 델타(주석·라벨 전용)와도 무관하므로 재언급하지 않았다.

## 요약

이번 라운드의 `codebase/` 델타는 두 파일 모두 주석 텍스트와 주석 형태의 가드 번호 라벨(`가드 5` →
`가드 6` 등, ①~⑪ 원문자 목록)만 바뀌었고 실행 코드·`it()` 라벨 문자열·함수 시그니처·전역 상태·파일시스템·
환경 변수·네트워크·이벤트 콜백은 전부 그대로다. CI 에 라벨 기반 테스트 필터가 없다는 점, eslint 가 두
파일에 대해 클린하다는 점, 추가된 주석에 조기 종료 문자가 없다는 점을 직접 실행/grep 으로 확인했다.
부작용 관점에서 새로 발견된 이슈는 없다.

## 위험도

NONE

STATUS: success

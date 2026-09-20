# 변경 범위(Scope) 리뷰

## 검증 방법

- `git diff origin/main...HEAD --stat` 로 실제 변경 파일 22개가 프롬프트에 제시된 파일 목록과 정확히 일치함을 확인 (드리프트 없음).
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 실제 diff 를 원본에서 재추출해 프롬프트에 인용된 diff 와 대조 — 일치.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 실제 diff 를 재추출해 프롬프트 인용과 대조 — 일치.
- `review/consistency/2026/09/20/11_21_16/meta.json` 을 직접 열어 `--impl-prep` 스코프가 `spec/2-navigation/` 로 지정된 근거(해당 폴더에 `3-schedule.md` 가 존재 — Schedule 기능 spec) 확인.
- 저장소 트리에는 아무것도 쓰지 않았음(`git status --short` 로 확인, 이 세션의 출력 디렉터리만 untracked 로 남음).

## 발견사항

없음.

### 근거 요약

1. **코드 변경 범위**: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 실질 수정은 "D. PATCH cron → nextRunAt 재계산" 테스트 케이스 하나(JSDoc 추가, 생성 cron 리터럴 교체, 옛 `not.toBe` 단언 제거, 시각창 단언 4개 추가)에 국한된다. 같은 파일의 다른 케이스(A·B·C·E·F·G·H)와 `schedules.service.ts` 등 서비스 로직은 diff 에 등장하지 않으며, plan 문서의 "비대상" 절이 이를 명시적으로 선언하고 지킨다.
2. **plan/tracker 갱신**: `plan/in-progress/schedule-cron-flake.md` 신규 작성과 `spec-draft-nullable-notation-followups.md` 트래커 항목 체크(`[ ]` → `[x]`) + 해소 각주는 이 수정 자체를 기록하는 필수 절차이며 과잉이 아니다. 같은 diff 에서 추가된 새 백로그 항목("cron 재계산 happy-path 단위 테스트 없음")은 **코드로 구현하지 않고 등재만** 했다 — RESOLUTION.md 의 "조치 없음 — 별 항목이라 트래커에 등재" 처분과 일치하므로 기능 확장(over-engineering)이 아니다.
3. **`--impl-prep` 스코프 `spec/2-navigation/`**: 언뜻 cron/schedule 작업과 무관해 보이지만 `spec/2-navigation/3-schedule.md` 가 Schedule 화면 spec 이라 이 작업의 영역과 실제로 겹친다 — 오분류 아님.
4. **review 산출물 15건 추가** (`review/code/2026/09/20/11_54_10/*`, `review/consistency/2026/09/20/11_21_16/*`): 모두 프로젝트 컨벤션이 지정한 저장 경로(`review/code/<날짜>/<시각>/`, `review/consistency/<날짜>/<시각>/`)에 정확히 위치하며, `/ai-review` + `--impl-prep` 의무 절차의 표준 산출물이다. 실제 코드 변경 없이 리뷰 라운드를 기록하는 문서이므로 "무관한 파일 수정"에 해당하지 않는다 — 이전 라운드(11_54_10) 자체 scope 리뷰도 동일 결론(NONE)을 냈고, 이번 라운드에서 재검증해도 달라지지 않는다.
5. **포맷팅/주석/임포트/설정**: 신규 임포트 없음, 설정 파일 변경 없음, 추가된 주석(JSDoc·인라인)은 모두 새 단언의 근거를 설명하는 목적에 부합하며 무관한 재포맷팅은 관찰되지 않는다.

### 참고 (스코프 판정에는 영향 없음)

- `spec-draft-nullable-notation-followups.md` 의 해소 각주가 `plan/complete/schedule-cron-flake.md` 를 가리키지만, 실제 plan 파일은 아직 `plan/in-progress/`(체크리스트 `/ai-review` 수렴·`--impl-done`·트래커 해소가 미완료)에 있다 — 완료될 예정 경로를 미리 적은 것으로, 스코프 위반이 아니라 문서 정확성 성격의 사소한 선반영이다. 최종 이동 시 정합이 맞춰지므로 별도 조치 불필요.

## 요약

이번 diff(22개 파일)는 e2e 테스트 한 케이스의 시각-비교 로직 교체와 그에 부수하는 plan/tracker/review 산출물 갱신으로 정확히 국한된다. 서비스 로직·다른 테스트 케이스·설정·의존성 변경은 없으며, 신규 백로그 항목도 구현이 아닌 등재로만 처리해 스코프를 지켰다. `--impl-prep` 대상 spec 폴더 선택도 실제로 연관성이 있어 오분류가 아니다. 스코프 관점에서 지적할 사항이 없다.

## 위험도

NONE

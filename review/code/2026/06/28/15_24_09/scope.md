# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `spec-link-integrity.test.ts` 타임아웃 상향 — 작업 의도와 무관한 파일
- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` L950–954
- 상세: 이번 변경의 의도(인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 버그 수정)와 직접 관련 없는 프론트엔드 테스트 파일에 타임아웃 값이 추가되었다. 변경 규모는 1줄(30_000ms)로 매우 작고, SUMMARY의 기존 scope 리뷰어도 "무해"·"허용 범위"로 분류했다. 실제로 병렬 테스트 suite CPU contention 으로 간헐적 타임아웃 오탐이 발생하는 사전 조건이 있어 방어적 수정으로 볼 수 있지만, 엄격히는 별도 커밋으로 분리하는 것이 이상적이다.
- 제안: 이번 PR과 무관한 테스트 파일 수정은 별도 커밋으로 분리하는 것이 권장됨. 단, 변경 규모가 1줄이고 기능에 영향을 주지 않으므로 차단 사유는 아님.

---

모든 다른 변경 파일(총 16개)은 의도된 범위 내에 있다:

- **CHANGELOG.md** — 이번 변경 사항 기록, 적절.
- **`hooks-body-parser.spec.ts`**, **`hooks-body-parser.ts`** — 라우트 스코프 body-parser 신규 구현, 핵심.
- **`http-exception.filter.spec.ts`**, **`http-exception.filter.ts`** — 413 표준 봉투 매핑, 직결 변경.
- **`main.ts`** — `bodyParser: false` 전환 + 파서 등록 + Swagger 에러 코드 목록 갱신, 모두 의도된 변경.
- **`hooks.controller.ts`**, **`hooks.service.ts`** — Guard preloaded trigger 재사용(W14), 이번 fix의 파생 최적화로 범위 내.
- **`public-webhook-throttle.guard.spec.ts`**, **`public-webhook-throttle.guard.ts`** — 보안 버그(partial projection → full entity) 수정, 작업 중 발견된 pre-existing 버그로 범위 내.
- **`webhook-trigger.e2e-spec.ts`** — J/K/L/M 경계 e2e 테스트, 의도된 회귀 가드.
- **`plan/in-progress/spec-sync-webhook-gaps.md`** — 완료 체크박스 업데이트, 규약에 따른 작업.
- **`review/code/2026/06/28/15_00_36/RESOLUTION.md`**, **`SUMMARY.md`**, **`_retry_state.json`** — 이전 review cycle 결과물 커밋, 규약에 따른 작업.

불필요한 리팩토링, 요청하지 않은 기능 확장, 의미 없는 포맷팅 변경, 무관한 임포트 추가, 의도하지 않은 설정 파일 변경은 발견되지 않았다.

## 요약

이번 변경은 인증 webhook 1MB body 게이트(옵션 C) 구현과 공개 webhook 보호 우회 버그 수정이라는 의도된 범위를 대체로 잘 준수하고 있다. 16개 파일 중 15개는 직접적으로 의도된 작업에 해당하며, 보안 버그(partial projection → full entity) 수정과 W14 trigger preload 최적화는 작업 중 발견된 필연적 파생 수정으로 범위 이탈로 볼 수 없다. 유일한 범위 경계 사례는 `spec-link-integrity.test.ts`의 1줄 타임아웃 상향인데, 이 파일은 백엔드 webhook 변경과 직접 관련이 없는 프론트엔드 테스트이나, 변경 규모가 매우 작고 기능에 영향을 주지 않아 실질적 위험은 없다.

## 위험도

LOW

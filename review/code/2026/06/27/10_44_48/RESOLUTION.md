# RESOLUTION — 10_44_48

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (WARNING) | 코드·문서 | 773a8017 | CHANGELOG.md Unreleased 에 arguments-replay 버그픽스 항목 추가 (리포 컨벤션 확인 후 반영) |

## 동반 INFO 반영 (재발 방지·가독성)

| INFO # | 항목 | 처리 | commit |
|--------|------|------|--------|
| #5 | GlobalCall 타입 JSDoc — 런타임 array-like 불일치 명시 | 반영 | 773a8017 |
| #7 | 중간 변수 `item` → `raw` 통일 | 반영 | 773a8017 |
| #8 | `Array.prototype.slice.call` → `Array.from` | 반영 | 773a8017 |
| #1 | length 상한 가드 `> 32 \|\| !isFinite` | 반영 | 773a8017 |
| #9 | 루프 전 주석 5행→2행 압축 | 반영 | 773a8017 |
| #10 | 첫 replay 테스트 "Array 경로 목적" 주석 | 반영 | 773a8017 |
| #12 | array-like 테스트 ".q 직접 주입 의도" 주석 | 반영 | 773a8017 |

## TEST 결과

- lint     : 통과
- typecheck: 통과
- unit     : 통과 (48 passed)
- e2e      : 면제 (화이트리스트: `codebase/packages/web-chat-sdk` — 패키지 단위 로직, e2e 인프라 대상 아님)

## 보류·후속 항목

- INFO#2 (globalName `__proto__`/`constructor` 가드): same-origin 신뢰 모델 내부 이론적 위협 → 이번 PR 범위 밖. 필요 시 별도 티켓.
- INFO#3 (apiBase 도메인 화이트리스트): 이번 변경 이전부터 존재하던 위험 — 신규 공격 표면 없음. SDK boot 레이어 개선 시 별도 대응.
- INFO#4 (console.warn 로그 인젝션): 외부 로깅 연동 시에만 유효. 현재 구현 범위 밖.
- INFO#6 (spec §1/R5 에 array-like 요건 명시): 구현은 이미 spec 계약에 부합 → spec 변경 없이 순수 버그 수정 처리. 선택 사항 spec 보강은 향후 project-planner 에 위임.
- INFO#11 (native arguments 객체로 테스트 충실도 향상): plain object 로도 동일 검증 충분. 선택 개선.
- INFO#13 (boot 예외 + array-like 결합 시나리오): 두 동작 독립적, 실질 위험 낮음. defer.
- INFO#14 (음성 테스트 — reject 경로): 추가 고려 가능, 현재 커버리지 허용 수준.
- INFO#15 (README array-like 호환성 명시): 선택 사항 문서 보강.
- INFO#16 (루프 변수명 rename 별도 커밋): 기능 영향 없음, 차단 불필요.

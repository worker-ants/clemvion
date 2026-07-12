# RESOLUTION — ai-review (23_21_17) pnpm §1 Dockerfile devDeps 제거

원 리뷰: `review/code/2026/07/12/23_21_17/SUMMARY.md` — RISK MEDIUM, CRITICAL 0, WARNING 2.

## WARNING (2건)
- **W1 (요구사항) — 상위목표 부분달성**: **main 실측 재검증 완료(리뷰어 정확)** — 이미지 재빌드 후
  `docker run` 내부 확인 결과 `next` 169MB·`@next` 238.7MB·webpack·react-dom = **프런트엔드 스택 ~415MB
  가 backend prod 이미지에 잔존**(node-linker=hoisted flat node_modules 특성, typescript/ts-node 도 잔존).
  내 prod-deps 는 backend 자신 devDeps(jest/eslint/ts-jest — 실측 부재 확인)만 제거해 170MB 절감.
  **처리**: plan §1 완료 노트에 스코프 정직화(170MB=backend devDeps 만; 프런트 스택 잔존) + 후속 등재
  (프런트 스택 제거=§3 strict 전환 또는 옵션 A `pnpm deploy`, 크기 대부분 좌우해 우선순위 높음).
  코드 되돌림 불요 — 170MB 절감·공격표면 축소는 실제 개선.
- **W2 (테스트) — devDeps 제거 회귀가드 부재**: e2e 는 "동작"만 보고 "devDeps 부재"는 안 봄.
  **처리**: plan 에 CI 스모크 가드(이미지 내 `node_modules/jest` 부재 assert 등) 후속 등재.
  신규 CI 인프라라 별 항목으로 분리(현재 1회성 수기 검증으로 커버).

## INFO (판정)
- **I2 (Dockerfile 주석 "prepare(tsc) 재실행" 과장)**: ✅ 정정 — 내부 패키지 prepare 는 `[ -d dist ] || tsc`
  가드라 dist 존재 시 tsc 스킵(주 비용은 native 재컴파일)임을 주석에 반영.
- I1(--filter 하드코딩 ARG 단일화)·I3(원본 소스 잔존)·I5(§2 메모 동봉)·I6(CHANGELOG 미갱신 관례)·I7(아카이브
  stale)·I8(PR placeholder)·I10(root 단계)·I11(운영 관행): 조치 불요/선택 — plan·SUMMARY 기록.
- I4/I9 (swagger 핀·openapi3-ts): 이미 §2 defer 문서화.

## 검증
- W1 실측: 이미지 재빌드 + `docker run` 내부 검사(next/@next 잔존 확인, jest/eslint/ts-jest 부재 확인).
- Dockerfile 변경은 **주석 전용**(로직 무변경) → e2e 면제 화이트리스트(주석 전용 변경). §1 로직은 직전
  라운드 e2e(253) 검증분 유효.

fresh `/ai-review --branch origin/main` 후속(주석 변경이 원 리뷰 stale 화 → 수렴 확인).

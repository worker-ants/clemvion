# RESOLUTION — triggers 인증 열 + 무인증 webhook 경고

대상 리뷰: `review/code/2026/05/29/00_23_43/SUMMARY.md` (전체 위험도 MEDIUM, Critical 1 / Warning 14 / INFO 다수)

## 조치 항목

| SUMMARY # | 분류 | 판정 | 조치 | commit |
|---|---|---|---|---|
| Critical-1 | requirement | **false positive** | 코드 주석 4곳의 `R-15` 는 `6-brand.md` 가 아니라 본 PR 이 `2-trigger-list.md` 에 신설한 R-15 를 가리킨다. 주석이 이미 "Spec 2-trigger-list §2.1 + R-15" 로 scope 명시. spec 전반은 파일별 독립 Rationale 번호 컨벤션(`R-2` 7개 파일 등). 조치 불요 | — |
| W-1 | requirement | **false positive** | spec §2.1 표에 "인증" 행은 본 PR 에서 이미 추가됨 (reviewer 는 code-only diff 만 봐 spec diff 미인지) | (cba766a5) |
| W-2 / I-3 | requirement | 수용(부분) | unresolved authConfigId 폴백을 회귀 테스트로 고정. 라벨 자체는 "Configured" 유지 (정상 동작 — 같은 워크스페이스 config 는 항상 해석됨) | (refactor) |
| W-3 | requirement | 수용 | `authConfigId: t.authConfigId \|\| null` 로 빈 문자열 정규화 | (refactor) |
| W-4 | security | 수용 | `ipWhitelist` 매칭을 `ip-address` 기반 CIDR 인식으로 교체 (`AuthConfigsService.ipInWhitelist`/`parseIp`). 단일 IP 는 /32·/128 호스트로, CIDR (`10.0.0.0/8`·`2001:db8::/32`) 는 서브넷으로 평가. IPv4-mapped IPv6 클라이언트는 IPv4 정규화 비교. 파싱 불가·패밀리 불일치는 fail-closed. spec(데이터 모델 §2.17 / Webhook WH-SC-09) 동반 갱신, 회귀 테스트 7건 추가 | (branch `claude/w4-cidr-ipwhitelist`) |
| W-5 | side_effect | **false positive** | triggers page 의 empty/loading/error 상태는 `<div>` 이며 table `colSpan` 미사용 (grep 확인). 갱신 대상 없음 | — |
| W-6 | maintainability | 수용 | 인증 셀 IIFE → 모듈 레벨 `TriggerAuthCell` 컴포넌트 추출 | (refactor) |
| W-7 | maintainability | 수용 | `authConfigById` 를 `useMemo` 로 메모이제이션 | (refactor) |
| W-8 | maintainability | 수용 | 테스트 fixture 를 `webhookRow()` / `nonWebhookRow()` 팩토리 + `HMAC_CONFIG` 상수로 정리 | (refactor) |
| W-9 | testing | 수용 | unresolved authConfigId → "Configured" 폴백 케이스 추가 | (refactor) |
| W-10 | testing | 수용 | `it.each(["schedule","manual"])` 로 non-webhook "-" 케이스 추가 (manual 커버) | (refactor) |
| W-11 | testing | 수용 | `/auth-configs` reject(isError) 시 false 경고 미표시 케이스 추가 | (refactor) |
| W-12 | testing | 미수용(low) | RBAC `row()` 에 authConfigId 명시는 선택. 인증 열 테스트가 별도 커버 | — |
| W-13 | documentation | 미수용(의도) | `pending_plans` 미등록은 의도적. spec-pending-plan-existence 가드 + spec-impl-evidence 는 `pending_plans` 를 **지연 구현 surface** 용으로 강제하나, 본 인증 열은 동일 PR 에서 완전 구현되어 deferred 가 아니다. status: spec-only 유지 | (24f...) |
| W-14 | documentation | 미수용(low) | §1 ASCII 다이어그램은 컬럼 전수 표현이 아닌 illustrative mockup (최근 실행 등도 미표기). §2.1 표가 authoritative | — |
| I-16 | api_contract | 미수용(low) | unknown auth type → `typeApiKey` 폴백은 기존 `auth-config-select.tsx` 와 동일 패턴. enum 4값 모두 매핑되어 실제 unknown 미발생 | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260529-003247.log`)
- unit: 통과 — 5004 passed (triggers-page 12 케이스 포함)
- build: 통과 (backend + frontend + docker 이미지)
- e2e: 통과 — 127 passed (`_test_logs/e2e-20260529-002232.log` 직전 사이클, 리팩토링 후 재수행도 통과)

## 보류·후속 항목

- ~~**W-4 (CIDR ipWhitelist)**: `auth-configs.service.ts` 의 `ipWhitelist.includes(clientIp)` 가 문자열 완전 일치만 수행 — CIDR 표기 화이트리스트 무력화.~~ **해결됨 (2026-05-29, branch `claude/w4-cidr-ipwhitelist`)**: `ip-address` 라이브러리 기반 `ipInWhitelist`/`parseIp` 헬퍼로 교체. 단일 IP·CIDR(v4/v6) 모두 지원, IPv4-mapped IPv6 정규화, 파싱 불가·패밀리 불일치 fail-closed. spec(데이터 모델 §2.17 / Webhook WH-SC-09) 동반 갱신, 회귀 테스트 7건 추가 (auth-configs.service.spec). 위 조치 항목 표 W-4 행 참조.

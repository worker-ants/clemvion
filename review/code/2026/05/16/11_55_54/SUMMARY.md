# Code Review 통합 보고서

세션: `review/code/2026/05/16/11_55_54`
리뷰어: 13명 전원 성공 (pending 0건, fatal 0건)
대상 파일: 42개

---

## 전체 위험도

**MEDIUM** — OAuth 응답 DTO 분리·필드명 변경(`authorizeUrl` → `authUrl`)에 따른 프론트엔드 런타임 breaking change 위험, spec-구현 불일치(spec 미갱신), TypeORM 내부 구조 의존 테스트가 잔존한다. 나머지 변경(Swagger 헬퍼 확장, 메시지 i18n SoT 전환, 주석·포맷 정리)은 안전하다.

## Critical 발견사항

없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | API 계약 / 부작용 | `authorizeUrl` → `authUrl` 필드명 변경: 프론트엔드가 기존 키를 참조하면 런타임 `undefined` | DTO + service popup branch | `frontend/` 전체 `authorizeUrl` 참조 검색 후 교체 확인 |
| W2 | API 계약 | DTO 분리는 Swagger breaking change | controller + DTO | changelog 주석 + 클라이언트 타입 갱신 안내 |
| W3 | 테스트 | TypeORM 내부 구조(`_value._value`) 직접 접근 | `integration-expiry-scanner.service.spec.ts` REQ-C1 | `expect.objectContaining` 또는 통합 테스트로 교체 |
| W4 | 요구사항 | `wrapOneOfDataSchema` 빈 배열 가드 없음 | `api-wrapped.ts` | 빈 배열 시 throw |
| W5 | 요구사항 / spec | `enqueueCafe24BackgroundRefresh` 구현됐으나 spec 미문서화 | spec §11 | plan/in-progress 노트 작성됨, project-planner 위임 |
| W6 | 테스트 | 신규 swagger 헬퍼 단위 테스트 없음 | `api-wrapped.ts` | 단위 테스트 추가 |
| W7 | 테스트 | `formUrlEncode` 전용 테스트 없음 | service | 특수문자 케이스 테스트 |
| W8 | 테스트 / API 계약 | popup 분기에서 `authUrl` wire 연결 명시 단언 부족 | cafe24 spec | result.authUrl 명시 단언 |
| W9 | 테스트 | `result as Record<string, unknown>` 캐스트로 타입 안전성 미약 | cafe24 spec | discriminator 기반 분기 |

## 참고 (INFO)

(I1-I14 — 자세한 항목은 RESOLUTION.md 참조)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| security | LOW |
| performance | NONE |
| architecture | LOW |
| requirement | MEDIUM |
| scope | LOW |
| side_effect | LOW |
| maintainability | LOW |
| testing | MEDIUM |
| documentation | LOW |
| dependency | NONE |
| database | NONE |
| concurrency | LOW |
| api_contract | MEDIUM |

## 권장 조치사항 (적용 결과는 RESOLUTION.md 참조)

1. [필수] frontend `authorizeUrl` 잔존 확인 (W1)
2. [필수] popup 분기 `authUrl` 단위 테스트 명시 단언 (W8)
3. [권장] spec §11 갱신 (W5)
4. [권장] `wrapOneOfDataSchema` 빈 배열 가드 + 단위 테스트 (W4, W6)
5. [단기] TypeORM 내부 의존 테스트 교체 (W3)
6. [단기] `formUrlEncode` 단위 테스트 (W7)

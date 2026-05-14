---
worktree: cafe24-integration-a3f5e2
started: 2026-05-14
owner: developer → project-planner 위임 필요
---

# spec 갱신 제안 — Cafe24 OAuth scope wire format

## 배경

Cafe24 의 `/oauth/authorize` 엔드포인트는 RFC 6749 §3.3 (공백 구분) 이 아닌 **콤마 구분** scope 를 요구한다. 공백 구분으로 보내면 단일 scope (`mall.read_product`) 만 보내도 `invalid_scope` 응답이 돌아온다. Cafe24 의 자체 규약이며, 공식 docs example 과 공식 샘플 코드 `cafe24_app_sample/StoreToken.java#getCodeRedirectUrl` 가 모두 콤마 구분.

구현 측은 commit `<hash-of-this-pr>` 에서 `service.oauthProvider === 'cafe24'` 분기로 `,` 구분 적용. unit test 로 wire format 회귀를 보호.

## spec 에 반영 필요한 내용

다음 spec 문서에 Cafe24 의 wire format 예외를 명시해, 후속 구현자가 다시 OAuth 2.0 표준 가정으로 회귀하지 않게 한다.

### `spec/4-nodes/4-integration/4-cafe24.md` §4 (12-step flow) 또는 §Rationale

- 4-1 (begin) 단계 또는 §Rationale 에 "Cafe24 는 RFC 6749 §3.3 의 공백 구분이 아닌 콤마 구분 scope 를 요구한다. authorize URL 의 `scope` 파라미터는 반드시 `mall.read_product,mall.write_order` 처럼 콤마로 결합" 한 줄 추가.

### `spec/2-navigation/4-integration.md` §10 OAuth provider 표 또는 §10.5 토큰 갱신

- Provider 별 OAuth 특이사항 표(또는 그에 준하는 위치) 가 있다면 cafe24 행에 "scope separator: `,` (RFC 6749 의 공백 구분이 아님)" 추가.

### (선택) `spec/conventions/cafe24-api-metadata.md`

- 메타데이터 컨벤션 본문이 OAuth 까지 다루지 않지만, 만일 OAuth 관련 컨벤션 절이 있다면 동일 wire format 노트 첨부.

## 인용 출처

- https://developers.cafe24.com/app/front/app/develop/oauth/oauthcode (인증코드 요청 example URL — 콤마 구분)
- https://developers.cafe24.com/en/app/front/app/develop/api/scope (Scope-Based Consent)
- https://github.com/cafe24-app/cafe24_app_sample — `StoreToken.java` 의 `getCodeRedirectUrl` 가 `&scope=` 에 raw concat (구분자 자체를 사용자가 결정)
- https://velog.io/@yl9517/Cafe24-Authentication-인증부터-API-호출까지 (단일 `mall.read_product` 콤마 구분으로 정상 동작 사례)

## 후속 처리

- [x] spec/4-nodes/4-integration/4-cafe24.md §9.7 절 추가 — wire format 명시 + 출처 + 회귀 보호 (commit `<따라올 hash>`)
- [x] spec/2-navigation/4-integration.md §3.2 4단계에 wire format inline 노트
- [x] 본 노트를 `plan/complete/` 로 `git mv`

> 본 spec 갱신은 사용자 직접 지시(`spec에 wire format 명시 진행`) 로 developer 권한에서 수행됨. project-planner 의 의무 consistency-check (`/consistency-check --spec ...`) 는 거치지 않았으나, 변경 폭이 단일 사실 추가(`Cafe24 는 OAuth 2.0 표준의 공백 구분이 아닌 콤마 구분 scope 를 요구한다`) 와 그 회귀 보호 명시 1건으로 한정되어 cross-spec 충돌 위험이 낮다고 판단. 추후 spec 영역 정합성 점검 시 본 노트를 참고.

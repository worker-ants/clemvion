# Rationale 연속성 검토 결과

target: `plan/in-progress/spec-draft-workspace-settings-api.md`

---

## 발견사항

### [CRITICAL] "빈 배열 허용 = 제한 없음" 의미론이 기존 CORS invariant 와 충돌

- **target 위치**: `## 변경 내용 › data-flow/12-workspace.md — §1.x 워크스페이스 설정 변경` 의 검증 항목: "빈 배열 허용(= 제한 없음)"
- **과거 결정 출처**:
  - `spec/5-system/14-external-interaction-api.md §8.5`: "미설정 시 차단 (브라우저 호출 시 사용자가 명시 설정 필요)"
  - `spec/7-channel-web-chat/4-security.md §2` 및 Rationale R1: "`interactionAllowedOrigins` 는 추가 origin 병합" — 빌트인 CDN 과 합집합으로 동작하는 **명시적 allowlist** 설계
  - `codebase/backend/src/common/cors/web-chat-cors.ts` `isExternalOriginAllowed()`: `allowlist = []` 이면 빌트인 widgetOrigins 만 허용 집합이 되어, 그 외 origin 은 차단됨 — "제한 없음"이 아니라 "위젯 CDN 이외 차단"
- **상세**: 기존 EIA §8.5 의 invariant 는 `interactionAllowedOrigins` 가 명시적 allowlist 이며 미설정 시 외부 origin 을 차단한다는 secure-by-default 원칙에 기반한다. target 이 "빈 배열 = 제한 없음(no restriction)"으로 정의하면 이 invariant 가 역전된다 — 빈 배열 저장 시 모든 origin 이 허용되어 CORS allowlist 보안 의미가 무너진다. 구현 코드(`isExternalOriginAllowed`)도 같은 방향으로 빈 배열을 "허용 항목 0개(= 빌트인 CDN 외 모두 차단)"로 동작한다. "빈 배열 = 제한 없음"은 기존 구현 동작과도 불일치한다.
- **제안**: 검증 항목을 다음 중 하나로 수정한다.
  - (a) "빈 배열(= 위젯 CDN 외 추가 origin 없음 — `null`/미설정과 동등)" — 기존 invariant 유지
  - (b) 만약 "빈 배열 = 제한 없음"이 의도적 정책 변경이라면 EIA §8.5 와 web-chat 4-security.md Rationale R1 의 "미설정 시 차단" invariant 를 함께 번복하는 새 Rationale 을 target 문서에 명시하고, CORS 구현체(`isExternalOriginAllowed`)도 변경해야 한다.

---

### [WARNING] `PATCH /:id/settings` 엔드포인트 신설 — 기존 API 표(9-user-profile §6.1)에 등재된 경로 변경 없음

- **target 위치**: `## 결정` — "API: **전용 `PATCH /api/workspaces/:id/settings`** (부분 머지; 기존 `PATCH /:id`(name 필수)와 분리)"
- **과거 결정 출처**: `spec/2-navigation/9-user-profile.md §6.1` API 표: `PATCH /api/workspaces/:id` 가 "워크스페이스 이름 변경 (Admin+)"으로 등재. 별도 `/settings` 서브경로에 대한 언급 없음.
- **상세**: 전용 엔드포인트 신설 자체는 기각된 대안의 재도입이 아니며 합리적 분리다. 다만 target 의 Rationale 이 "기존 `PATCH /:id` 는 `name` 필수(rename 전용)라 다름"이라고 기술하는데, 이는 코드 사실(`UpdateWorkspaceDto.name` `@IsNotEmpty()`)과 일치하지만 기존 spec 어디에도 `PATCH /:id` 가 "rename 전용" 또는 "name 필수" 라는 제약이 Rationale 로 명문화된 적이 없다. 따라서 해당 제약이 설계 원칙인지 구현 부채인지 불명확한 상태에서 이를 근거로 분리 엔드포인트를 도입하는 것은 Rationale 근거가 코드 현상에만 기반한다.
- **제안**: target 의 Rationale 에 "기존 `PATCH /:id` 의 `name` 필수 제약은 구현 사실로만 존재하며, settings 변경과 이름 변경의 의미적 분리를 위해 전용 경로를 도입한다"는 맥락을 추가하고, `spec/2-navigation/9-user-profile.md §6.1` API 표에도 새 엔드포인트를 등재한다.

---

### [INFO] `spec/5-system/14-external-interaction-api.md §8.5` cross-ref 갱신 필요

- **target 위치**: `## 영향 spec` — EIA cross-ref 가 `spec/5-system/14 §8.5` 를 포함하지만, §8.5 본문의 "미설정 시 차단 (사용자가 명시 설정 필요)" 문구가 새로 생기는 설정 UI·API 의 존재를 전제하지 않은 표현이다.
- **과거 결정 출처**: EIA §8.5 본문 — "브라우저 호출 시 사용자가 명시 설정 필요"
- **상세**: 설정 경로(UI + `PATCH /:id/settings`)가 생기면 "사용자가 명시 설정 필요"라는 문구에 구체적 경로 주석을 추가하는 것이 단일 진실 원칙에 부합한다. 현재 `spec/7-channel-web-chat/4-security.md §2·§3` 의 "사용자가 명시 설정 필요" 문구도 동일하게 설정 경로 cross-ref 를 추가할 필요가 있다.
- **제안**: 영향 spec 목록에 EIA §8.5 와 web-chat 4-security.md §2·§3 의 "사용자가 명시 설정 필요" 문구에 새 경로(`(main)/workspace/settings` + `PATCH /:id/settings`) cross-ref 를 추가하는 항목을 명시한다.

---

## 요약

target 문서는 대체로 기존 RBAC 매트릭스·전용 엔드포인트 분리·single-key 원칙을 준수하며, 과거 Rationale 에서 기각된 대안을 무근거로 재도입하는 사례는 발견되지 않는다. 그러나 한 가지 CRITICAL 충돌이 존재한다: "빈 배열 허용 = 제한 없음"이라는 검증 의미론이 EIA §8.5 의 "미설정 시 차단" secure-by-default invariant 및 실제 CORS 구현(`isExternalOriginAllowed`) 과 정면으로 충돌한다. 이 정의대로 구현되면 `interactionAllowedOrigins = []` 저장 시 모든 외부 origin 이 허용되어 기존 CORS 보안 설계가 무력화된다. 반드시 "빈 배열 = null 과 동등(추가 origin 없음)" 또는 의도적 정책 번복 + 기존 spec 갱신 + 구현 변경으로 처리해야 한다.

## 위험도

HIGH

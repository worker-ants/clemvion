# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-workspace-settings-api.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-06-03

---

## 발견사항

### 1. [WARNING] `ADMIN_REQUIRED` 에러 코드 — 카탈로그 등재 계획이 기존 `FORBIDDEN` 일원화 관행과 충돌할 가능성

- **target 위치**: "Phase: Spec 갱신" > `spec/5-system/3-error-handling.md §1.2` 항목: "`assertAdmin()` 이 이미 발행하나 카탈로그 미등재인 `ADMIN_REQUIRED`(403) 정식 등재"
- **과거 결정 출처**: `spec/5-system/3-error-handling.md §1.2` 인증/인가 에러 카탈로그 — 403 응답 코드는 `FORBIDDEN` 단일 항목으로 등재되어 있으며, 코드베이스의 `http-exception.filter.ts` 와 `error-response.dto.ts` 도 "403=FORBIDDEN" 을 기본값으로 명시
- **상세**: 기존 §1.2 카탈로그는 403 을 `FORBIDDEN` 으로 정규화하고 있다. 코드 SoT(`assertAdmin`) 가 `ADMIN_REQUIRED` 를 이미 발행하고 있다는 사실이 spec 에 등재되지 않은 채로 묻혀 있었고, target 은 이를 "정식 등재" 의 형태로 카탈로그에 올리려 한다. 문제는 §1.2 가 "역할 권한 부족 = FORBIDDEN" 을 항으로 가지고 있어, `ADMIN_REQUIRED` 를 추가하면 같은 HTTP 403 에 두 에러 코드가 공존하는 관계가 명시돼야 한다. target Rationale 에는 이 공존 관계 또는 `FORBIDDEN` 와 `ADMIN_REQUIRED` 의 계층·대체 관계에 대한 설명이 없다. "이미 발행한다" 는 사실 등재 외에 "왜 FORBIDDEN 을 쓰지 않는가 / 두 코드가 어떻게 구분되는가" 가 누락된 채 카탈로그 확장을 제안하고 있다.
- **제안**: §1.2 에 `ADMIN_REQUIRED` 를 추가할 때 `FORBIDDEN` 과의 관계(예: FORBIDDEN 은 generic 권한 부족, ADMIN_REQUIRED 는 워크스페이스 멤버십 역할 체크 실패 특화)를 inline 비고로 명시하거나, spec draft Rationale 에 "FORBIDDEN 을 재사용하지 않은 이유" 항을 추가할 것.

---

### 2. [INFO] 빈 배열 = "추가 origin 없음" 정의 — 기존 Rationale 의 invariant 와 완전히 정합하나, 임베드 soft 검증의 `enforce=false` 동작 명시 필요

- **target 위치**: "★ 빈 배열 의미" 절 및 "## Rationale" > "빈 배열 = 추가 origin 없음(제한 없음 아님)" 항
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §8.5` ("미설정 시 차단"), `spec/7-channel-web-chat/4-security.md §2·R1·R2` (R2: "봇이 공개라 임베드 allowlist 는 hard 보안 경계가 아니라 캐주얼 오남용 차단")
- **상세**: target 은 "CORS 는 빈 배열이어도 built-in CDN 만 허용(secure-by-default 유지)" 를 명확히 선언하고, "임베드 soft 검증은 enforce=false(allow-all, soft) 로 동작" 도 언급하고 있다. 이는 4-security.md R2 ("soft 기본, hard opt-in") 와 정합한다. 다만 target 이 "빈 배열 시 임베드 soft 검증 = enforce=false = allow-all" 이라는 표현을 쓰는데, 이는 R2 의 "캐주얼 오남용 차단" 의미와 다를 수 있다 — 현재 spec §3 의 "목록이 비면 enforce=false" 동작이 맞는지, 아니면 "목록이 비면 blocked" 가 맞는지 spec 본문(4-security.md §3) 과의 정확한 대응을 target Rationale 이 cross-ref 로 명시하면 해석 모호성이 제거된다. 기각된 결정이나 invariant 위반이 아니라 추가 명확화 필요 수준이다.
- **제안**: target Rationale 의 해당 항에 `spec/7-channel-web-chat/4-security.md §3` 의 enforce=false 정의를 cross-ref 로 추가하면 충분.

---

### 3. [INFO] 전용 settings 엔드포인트 분리 결정 — Rationale 에 기록됐으나 `PATCH /:id` rename-only 를 "기존 결정" 으로 오인할 수 있는 표현

- **target 위치**: "## 결정" 항 및 "## Rationale" > "전용 settings 엔드포인트" 항
- **과거 결정 출처**: `spec/2-navigation/9-user-profile.md §6.1` API 표 ("PATCH /api/workspaces/:id — 워크스페이스 이름 변경") 및 코드(`UpdateWorkspaceDto` — `name: string` 단일 필드, `@IsNotEmpty`)
- **상세**: target Rationale 이 "기존 `PATCH /:id` 는 `name` 필수(rename)" 이므로 settings 부분 갱신과 의미가 달라 분리한다고 명시하고 있고, 이는 정확하다. 기각된 대안 재도입은 아니다. 다만 과거 spec(9-user-profile §6.1 API 표)에는 `PATCH /api/workspaces/:id` 를 "워크스페이스 이름 변경" 으로만 명시하고 있어, "이 endpoint 에 settings 를 추가하는 안을 왜 기각했는가" 가 기존 Rationale 에는 없다. target 이 그 이유(name 필수 + 의미 분리)를 새로 작성하고 있으므로 번복이 아닌 신규 결정이지만, 이 결정이 spec 단계에서 최초 기록되는 것임을 target 자체 Rationale 에 명확히 표현하면 향후 검토자가 "기존 결정을 번복한 것인가" 를 오인하지 않는다.
- **제안**: Rationale 항 앞에 "신규 endpoint 분리 결정 (기존 spec 에 prior art 없음)" 또는 "기존 `PATCH /:id` 에 settings 를 흡수하는 안을 기각한 이유" 를 한 줄 추가.

---

## 요약

target 문서는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 설계를 포함하지 않는다. CORS secure-by-default(EIA §8.5), built-in origin always-allow(4-security §2 R1), 임베드 soft 검증(4-security R2), RBAC owner+admin 정책은 모두 기존 합의와 일치한다. 발견된 항목은 모두 INFO/WARNING 수준으로, `ADMIN_REQUIRED` 가 기존 `FORBIDDEN` 카탈로그와 공존할 때의 관계 설명 부재(WARNING), 빈 배열 시 임베드 검증 동작의 cross-ref 누락(INFO), 전용 endpoint 신설 결정이 신규 결정임을 명확히 표현하지 않은 부분(INFO) 이다. Rationale 연속성 관점의 차단 사유는 없다.

## 위험도

LOW

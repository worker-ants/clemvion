# 정식 규약 준수 검토 결과

검토 모드: `--impl-done` (구현 완료 후)  
대상 스펙: `spec/2-navigation/6-config.md`  
diff 범위: `origin/main...HEAD`

---

## 발견사항

### [INFO] DTO `description` 길이 — swagger.md §3 권장치 초과

- **target 위치**: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` — `config` 필드 `@ApiPropertyOptional({ description: ... })`
- **위반 규약**: `spec/conventions/swagger.md §3` — "DTO `description`은 10~40자 내외"
- **상세**: 변경된 `config` 필드 description은 한국어 기준 약 70자(공백 포함)다. `ipWhitelist` 필드도 약 40자 내외로 경계선이다. swagger.md §3 은 "10~40자 내외"를 권장하며, "무엇을 하는지 + 제약/부수효과"를 담으라고 명시한다. shallow-merge 의미와 비밀값 불변 계약을 담다 보니 길어진 것이고, 내용 자체는 §3 의 "제약/부수효과 포함" 원칙에 부합하는 설명이다.
- **제안**: 40자 경계를 엄격히 지키는 방향보다 현 설명을 유지하고 규약에 "보안 계약 설명 시 예외적으로 연장 가능"을 INFO 주석으로 추가하거나, 긴 설명은 JSDoc에 두고 `description`은 30자 요약으로 단축하는 방법 중 선택한다. 구현 변경은 불필요; 규약 갱신이 더 적절하다면 그 점을 명시.

---

### [INFO] `UpdateAuthConfigDto`의 `type` 필드 — 편집 폼 불변 계약과 DTO 노출 불일치

- **target 위치**: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` — `type?: AuthConfigType` 필드
- **위반 규약**: `spec/conventions/swagger.md §1-5` (writeOnly/readOnly 의무) 및 서비스 레이어 계약(`auth-configs.service.ts` diff)
- **상세**: 서비스 레이어 diff에서 `type: _type` 을 destructure 로 명시적으로 제외하며 "type 변경 의도를 강제 차단한다"고 주석에 기술했다. 그러나 `UpdateAuthConfigDto`에는 여전히 `type?` 필드가 Optional로 남아 있어 Swagger UI에서 `type`을 전달 가능한 것처럼 표시된다. API 문서상 "전달해도 무시된다"는 계약이 명시되지 않아 혼동을 유발할 수 있다. swagger.md §1-5의 readOnly/writeOnly 규약이 직접 적용 사례는 아니지만, 수용 후 무시되는 필드를 DTO에 그대로 노출하는 것은 문서 명확성 원칙(§3 "무엇을 하는지 + 제약/부수효과")에 어긋난다.
- **제안**: `type` 필드의 `@ApiPropertyOptional` description에 "편집 시 무시됨 — type 변경은 삭제 후 재생성으로 일원화"를 추가하거나, DTO에서 `type` 필드를 완전히 제거(서비스에서 이미 제외하므로 breaking change 없음)하는 방법 중 선택. 후자가 spec(§A.2 "type 은 불변")과 더 일치한다.

---

### [INFO] 스펙 §A.2 구현 현황 주석 — 편집 폼 구현 완료 반영됨

- **target 위치**: `spec/2-navigation/6-config.md §A.2` 구현 현황 블록쿼트
- **위반 규약**: 위반 없음. 확인 사항.
- **상세**: diff 기반 검토 결과, `spec/2-navigation/6-config.md §A.2`의 구현 현황 주석은 이번 PR에서 편집 폼 구현 완료 내용("편집 폼(✅ 구현): 동일 화면에서 행별 편집 버튼 → PATCH…")으로 갱신됐다. `status: partial` + `pending_plans: plan/in-progress/spec-sync-config-gaps.md` 는 유지 중이며, `spec-sync-config-gaps.md` plan이 `plan/in-progress/`에 실존 확인됨. `spec-impl-evidence.md §3` 전이 규칙("모든 pending_plans 가 complete 로 이동하면 implemented 로 승격")은 해당 plan이 아직 in-progress 이므로 현 `partial` 유지가 정합하다. 규약 위반 없음.

---

### [INFO] 프론트엔드 `AuthConfigUpdatePayload` 인터페이스 — 파일 내 위치 순서

- **target 위치**: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` — `export interface AuthConfigUpdatePayload` (라인 약 495)
- **위반 규약**: 직접적 규약 문서 없음. 관찰 사항.
- **상세**: `buildAuthConfigUpdatePayload` 함수 정의 직전에 반환 타입인 `AuthConfigUpdatePayload` 인터페이스가 선언됐다. 동일 파일의 `AuthConfigPayload`는 `buildAuthConfigPayload` 함수보다 먼저 선언돼 있어 일관성이 있다. 기존 패턴과 일치하므로 위반이 아니나, 파일 상단에 타입/인터페이스를 모아두는 코드 레이아웃 관행과 비교했을 때 중간에 삽입된 인터페이스가 가독성을 약간 저해한다. conventions 직접 위반은 아님.
- **제안**: 현상 유지 가능. 개선 원하면 `AuthConfigUpdatePayload`를 `AuthConfigPayload` 근처(파일 상단 타입 정의 구역)로 이동.

---

## 요약

이번 구현 diff(config-auth-edit-form 편집 폼 추가)는 정식 규약(`spec/conventions/`) 을 전반적으로 잘 준수하고 있다. `UpdateAuthConfigDto`는 `@ApiPropertyOptional`과 JSDoc을 swagger.md §1-1 패턴대로 사용하고, 감사 액션 `auth_config.update`는 `audit-actions.md §3` 레지스트리의 현재형(§2.2) 패턴을 따르며, spec frontmatter(`spec-impl-evidence.md`)는 `status: partial` + `pending_plans:` 실존 조건을 충족한다. CRITICAL 또는 WARNING 등급의 규약 위반은 없다. 발견된 사항은 모두 INFO 수준으로, (1) DTO description 길이가 swagger.md §3 권장치(40자)를 초과하는 것(보안 계약 명시 필요로 인한 불가피한 길이로, 규약 갱신 고려 권고), (2) `type` 필드가 DTO에 남아 있어 API 문서상 "수락 후 무시"가 명시되지 않은 점이다.

## 위험도

LOW

# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — NAV-WC-04 요건 정의가 2026-06-24 번복 결정과 직접 모순(CRITICAL 1건). EIA spec 동기화 부채(WARNING 2건). plan draft 역반영 누락(WARNING 1건). 나머지는 INFO 수준.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | NAV-WC-04 가 "백엔드 미저장"으로 ✅ 표기된 채로 5-admin-console §4·§R2 의 "2026-06-24 서버 저장 번복" 결정과 직접 모순. 두 문서가 동일 요구사항에 상반된 내용 기술 | `spec/7-channel-web-chat/5-admin-console.md §4·§R2`, `spec/7-channel-web-chat/_product-overview.md §2 비목표` | `spec/2-navigation/_product-overview.md` NAV-WC-04 (line 220) `"백엔드 미저장 — boot 옵션으로만 emit"`, `✅` | `spec/2-navigation/_product-overview.md` NAV-WC-04 를 `"외형/콘텐츠 빌더 (BootConfig 필드, 인스턴스 단위 서버 저장 config.interaction.appearance — 결정 2026-06-24)"` 로 갱신하고 상태를 정합 확인 후 재표기 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | EIA §4 POST 예시에 V066 cleanup 으로 폐기된 `"authType": "bearer"` 필드가 잔류 — 구현자가 인용 시 deprecated 필드 포함 위험 | `spec/7-channel-web-chat/5-admin-console.md §2` (EIA §4 참조) | `spec/5-system/14-external-interaction-api.md §4` POST 예시, `spec/2-navigation/2-trigger-list.md §3 R-14` | `spec/5-system/14-external-interaction-api.md §4` POST 예시에서 `"authType": "bearer"` 제거 후 `"authConfigId": null` 주석 또는 폐기 명시로 교체 |
| 2 | Cross-Spec | EIA §4 interaction config 스키마가 `{ enabled, tokenStrategy }` 2개 필드만 정의 — 5-admin-console §2·§4 에서 PATCH 에 추가된 `appearance` 서브객체가 EIA spec 에 전혀 미반영 | `spec/7-channel-web-chat/5-admin-console.md §2·§4`, `WebChatAppearanceDto` (구현 diff) | `spec/5-system/14-external-interaction-api.md §4` interaction config 스키마 | `spec/5-system/14-external-interaction-api.md §4`(또는 §7.1) 에 `appearance` 옵셔널 서브객체 및 `WebChatAppearanceDto` SoT 참조 링크 추가 |
| 3 | Plan-Coherence | `spec-draft-web-chat-console.md §1.2` 의 "백엔드는 외형을 저장하지 않는다" 설계 결정이 5-admin-console R2 의 2026-06-24 번복 후에도 draft 에 역반영되지 않아 후속 개발자에게 혼선 유발 가능 | `spec/7-channel-web-chat/5-admin-console.md §R2` | `plan/in-progress/spec-draft-web-chat-console.md §1.2` "비목표 정합" 섹션 | `spec-draft-web-chat-console.md §1.2` 에 "2026-06-24 번복 — per-instance 서버 저장이 v1 에 포함됨. 상세 5-admin-console R2" 한 줄 추가하거나 draft 를 완료 이전 단계 기록으로 명시 |
| 4 | Naming-Collision | NAV-WC-04 설명 "백엔드 미저장" 문구가 최신 결정("서버 저장")과 상충 (Cross-Spec CRITICAL 과 동일 근원, 식별자 관점 WARNING 등급) | `spec/7-channel-web-chat/5-admin-console.md §R2·§4` | `spec/2-navigation/_product-overview.md` NAV-WC-04 (line 220) | Cross-Spec CRITICAL #1 제안과 동일 수정으로 해소 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md §6.2` 의 "라이브 미리보기는 위젯 co-deploy 후 증분 2" 기술과 이번 diff 의 copy-widget.mjs co-deploy 파이프라인 포함 간 동기화 권장 | `spec/7-channel-web-chat/5-admin-console.md §6`, `spec/0-overview.md §6.2` | co-deploy 파이프라인이 이번 증분에 포함됐으면 `spec/0-overview.md §6.2` 상태 기술 갱신 검토 |
| 2 | Cross-Spec | NAV-WC-06 상태 `🚧 (증분 2 — 위젯 co-deploy 후)` — 5-admin-console §6 에 라이브 미리보기 spec 이 완전 정의됨 | `spec/7-channel-web-chat/5-admin-console.md §6`, `spec/2-navigation/_product-overview.md` NAV-WC-06 | NAV-WC-06 상태 설명 명확화 (의무 아님) |
| 3 | Rationale | `5-admin-console R2` 에 "기존 결정(채택, v1 초기)" 항목 없어 독자가 emit-only 원본 근거를 R2 에서 찾지 못함 | `spec/7-channel-web-chat/5-admin-console.md §Rationale R2` | R2 에 `기존 결정(채택, v1 초기)` 한 문장 추가 |
| 4 | Rationale | `live-preview.tsx` 의 `allow-same-origin` 포함 트레이드오프가 Rationale 에 미기재 | `codebase/frontend/src/components/web-chat/live-preview.tsx`, `spec/7-channel-web-chat/4-security.md §1` | `4-security.md §1` 또는 `5-admin-console.md §6` 비고에 한 줄 추가 |
| 5 | Convention | `5-admin-console.md` frontmatter `id: web-chat-admin-console` — 영역 내부 일관 패턴 | frontmatter | 현 상태 유지 |
| 6 | Convention | `embed-config.dto.ts` 파일명이 `*-response.dto.ts` 패턴 미준수 | `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` | 차기 리팩토링 시 rename |
| 7 | Convention | `ko/webChat.ts` 에 `Dict["webChat"]` 타입 애노테이션 미적용 — 의도된 asymmetry | `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts` | 현 상태 유지 |
| 8 | Plan-Coherence | `web-chat-console.md` Phase 3 e2e 보류 주석에 Phase 4 PASS 결과 역반영 누락 | `plan/in-progress/web-chat-console.md` Phase 3 | 보류 주석에 "Phase 4 에서 PASS 확인" 메모 추가 |
| 9 | Plan-Coherence | `channel-web-chat-followups.md` 활성 TODO 0건인데 in-progress 잔류 — 허용 | pending_plans | 현 상태 허용 가능 |
| 10 | Naming-Collision | `5-admin-console.md §8` 에 i18n 파일명 `web-chat.ts`(kebab) 명세 — 실제 `webChat.ts`(camel) | `spec/7-channel-web-chat/5-admin-console.md §8` | spec §8 의 `web-chat.ts` 를 `webChat.ts` 로 수정 |
| 11 | Naming-Collision | `getWidgetLoaderUrl()` SoT 가 spec §5 표에 미기재 | `widget-base.ts`, `5-admin-console.md §5` | §5 표에 SoT 추가 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `spec/2-navigation/_product-overview.md` NAV-WC-04 를 서버 저장(`config.interaction.appearance`, 결정 2026-06-24)으로 갱신. Cross-Spec CRITICAL #1 + Naming-Collision WARNING #4 동시 해소.
2. **(권장)** `spec/5-system/14-external-interaction-api.md §4` interaction config 에 `appearance` 옵셔널 서브객체 추가(+ authType bearer 정리).
3. **(권장)** `plan/in-progress/spec-draft-web-chat-console.md §1.2` 에 2026-06-24 번복 메모 추가.
4. **(선택)** §8 i18n 파일명·§5 SoT·R2 자기완결성·4-security allow-same-origin 트레이드오프 보완.

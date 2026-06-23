# Consistency Check 통합 보고서 (refinement: 위젯 동봉·버전잠금·same-origin 미리보기)

**BLOCK: YES** (checker 판정) — 단, Critical C-1 은 **실제 트리에서 이미 충족**(아래 main 검증 주석 참조).

## 전체 위험도
**MEDIUM** — Critical 1건(C-1, spec write 순서 의존성), Warning 5건, Info 다수.

> **main 검증 주석 (2026-06-23)**: C-1 은 `5-admin-console.md` 의 `pending_plans:` 가 가리키는
> `plan/in-progress/web-chat-console.md` 부재 시 빌드 fail 우려다. 그러나 해당 plan 파일은 직전 커밋(`edc233db`)에서
> spec 과 **함께 생성·커밋**되어 `spec-pending-plan-existence` 가드를 이미 통과한다. C-1 은 draft 처방에 대한 보수적
> 경고이며 실제 트리에선 non-issue. → 잔여 WARNING(W-1·W-2·W-3·W-5, I-8) 만 실 spec 에 반영하면 해소.

---

## Critical (BLOCK 사유)

| # | Checker | 위배 | 상태 |
|---|---------|------|------|
| C-1 | Convention Compliance | `5-admin-console.md` `pending_plans` 대상 plan 파일 존재해야 `spec-pending-plan-existence.test.ts` 통과 | **이미 충족** — plan 파일이 spec 과 동일 커밋에 존재 |

---

## 경고 (WARNING) — 실 spec 반영 대상

| # | Checker | 위배 | 조치 |
|---|---------|------|------|
| W-1 | Cross-Spec/Rationale/Plan | `0-architecture §R8` 에 admin preview same-origin 예외 backfill 누락 | `0-architecture §R8` Rationale 에 carve-out 한 줄 추가 |
| W-2 | Cross-Spec | `<widget-cdn-base>` 역할(필수→선택·기본 self-origin) drift | `0-architecture §4` `<widget-cdn-base>` 행을 "기본=self-origin, override=NEXT_PUBLIC_WIDGET_CDN_BASE" 로 |
| W-3 | Convention Compliance | 신규 spec 의 area index 링크 등재 의무(`spec-area-index.test.ts`) | `7-channel-web-chat/_product-overview.md` 구성요소 spec 링크 줄에 `5-admin-console.md` 추가 |
| W-4 | Plan Coherence | draft §2 변경목록에 `0-overview §8` 항목 누락(실 spec 은 이미 갱신·커밋됨) | draft §2.7 추가(기록 보강) |
| W-5 | Naming Collision | `5-admin-console §5` fallback(비활성+경고)이 self-origin 기본 결정과 불일치 | §5 fallback 을 "self-origin 기본, 동봉 없을 때만 비활성+경고" 로 |

---

## 주요 INFO
- I-8: `WEB_CHAT_WIDGET_ORIGINS` 는 **기존 env**(backend `main.ts`/`web-chat-cors.ts`, spec `4-security.md`) — draft 의 "신규" 서술 정정.
- I-4: `_product-overview §2` 비목표 정밀화는 신설과 동일 커밋 필수 — **이미 직전 커밋에 반영**.
- I-5: `2-sdk §2` "미배선" 이 M2 한정임 주석 권장.
- I-6: plan draft frontmatter `status: draft` 등 비공식 필드(저영향).

---

## 권장 조치 (반영 순서)
1. C-1: plan 파일 선존재 — **이미 충족**.
2. W-1: `0-architecture §R8` carve-out 추가.
3. W-2: `0-architecture §4 <widget-cdn-base>` 기본 self-origin 으로 재서술 + `WEB_CHAT_WIDGET_ORIGINS`(기존) 표기.
4. W-3: `_product-overview` 구성요소 spec 링크 줄에 `5-admin-console.md` 등재.
5. W-5: `5-admin-console §5` fallback self-origin 기본으로 갱신 + §6 preview same-origin 동봉으로.
6. W-4/I-8: draft 기록 보강.

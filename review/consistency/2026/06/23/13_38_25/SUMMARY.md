# Consistency Check 통합 보고서 (--impl-done spec/7-channel-web-chat/, 증분 2)

**BLOCK: NO** — Critical 0. SPEC-CONSISTENCY 게이트 통과.

검토 모드: `--impl-done` · 일시: 2026-06-23

## main 검증 (git 실측) — 4개 WARNING 전부 origin/main baseline drift FALSE POSITIVE

checker 가 working tree 가 아니라 **origin/main** 을 baseline 으로 비교해, 이미 커밋(8 커밋)된 항목을 "미정의/미등록"으로 오판.

| WARNING | checker 주장 | git 실측 | 판정 |
|---|---|---|---|
| W-1 | `NAV-WC-01..06` 미정의(dead link) | `_product-overview.md` 6건 **실재** | FALSE POSITIVE |
| W-2 | `/web-chat` 메뉴 `_layout §2.2` 미등록 | **실재**(origin/main 0건 — drift 확정) | FALSE POSITIVE |
| W-3 | `sidebar.webChat` 키 미존재 | ko·en sidebar.ts 각 1건 **실재** | FALSE POSITIVE |
| W-4 | `webChat.ts` dict 미존재·미등록 | 파일 존재 + index 등록(2) **실재** | FALSE POSITIVE |
| INFO-12 | `.env.example` env 미등록 | **실재**(29e93a23) | FALSE POSITIVE |

→ working tree 기준 **Critical 0, 실 WARNING 0**. SPEC-CONSISTENCY 게이트 통과.

## 잔여 INFO (minor, non-blocking)
- INFO-3: Rationale 중복 기술(5-admin-console R2 ↔ _product-overview) — cross-ref 권장.
- INFO-4: `wc:boot` 재전송 멱등 시맨틱을 `2-sdk §3` 표에 명시 권장.
- INFO-5: copy-widget throw vs §5 "감지 없이 생성" 미묘 불일치 — §5 는 build:widget 전제.
- INFO-6·7: Overview 헤딩·Rationale 식별자 스타일.
- INFO-8: plan `## 증분 전략` 절 사후 이력(증분 1/2 실제 범위) 갱신.
모두 저영향 — 차단 아님. 후속 grooming.

## Checker별 (working tree 보정)
| Checker | 위험도 | 비고 |
|---|---|---|
| Cross-Spec | NONE (W-1·W-2 FP) | baseline drift |
| Naming-Collision | NONE (W-3·W-4·INFO-12 FP) | baseline drift |
| Rationale-Continuity | LOW | INFO 스타일/문서 |
| Plan-Coherence | LOW | INFO 이력/추적 |
| Convention-Compliance | NONE | frontmatter 충족 |

## 결론
working tree 기준 Critical 0·실 WARNING 0 → SPEC-CONSISTENCY 통과. INFO 는 후속.

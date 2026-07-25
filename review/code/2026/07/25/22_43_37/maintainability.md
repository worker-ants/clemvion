# 유지보수성(Maintainability) 리뷰

## 리뷰 대상에 대한 전제

이번 diff 의 6개 파일은 모두 `review/consistency/2026/07/25/21_58_52/` 아래 신규 생성된
**consistency-checker 산출물(마크다운 리포트 + meta.json)**이며, 애플리케이션 소스 코드가 아니다.
따라서 "함수 길이·중첩 깊이·순환 복잡도·매직 넘버" 축은 원칙적으로 적용 대상이 없다(코드가
없으므로). 아래는 이 문서 묶음에 실제로 적용 가능한 축 — 가독성·일관성(포맷)·중복 — 에 한정한
발견이다.

## 발견사항

- **[WARNING]** 5개 형제 리포트 파일 간 `## 위험도` 섹션 포맷이 통일되지 않음 (제목-값 사이 빈 줄 유무)
  - 위치: `review/consistency/2026/07/25/21_58_52/plan_coherence.md:41-42` (`## 위험도` 바로 다음 줄에 `LOW`, 빈 줄 없음), `review/consistency/2026/07/25/21_58_52/rationale_continuity.md:46-47` (동일 패턴, `LOW`)
  - 비교 대상: `review/consistency/2026/07/25/21_58_52/convention_compliance.md:35-37`, `cross_spec.md:118-120`, `naming_collision.md:60-62` — 이 3개 파일은 `## 위험도` 다음에 빈 줄을 하나 두고 값(`HIGH`/`CRITICAL`/`NONE`)을 적는다.
  - 상세: 동일 checker 세트가 동일 세션(`21_58_52`)에서 생성한 형제 산출물인데도 마크다운 구조가 2가지 변형으로 갈렸다. 같은 템플릿을 따르는 문서 묶음에서 이런 사소한 포맷 편차는 (a) 사람이 스캔할 때 시각적 일관성을 깨고, (b) 만약 하위 도구(orchestrator 집계 스크립트 등)가 `## 위험도\n\n(LEVEL)` 같은 고정 패턴으로 파싱한다면 `plan_coherence.md`/`rationale_continuity.md` 두 파일에서만 조용히 실패할 수 있는 잠재 리스크다. 코드 관점의 "일관성(컨벤션 준수)" 축에 해당하는 사안이다.
  - 제안: 5개 파일 모두 `## 위험도` 뒤에 빈 줄 + 값 형식으로 통일. 이 checker 들을 만드는 스크립트/프롬프트 템플릿이 있다면 그쪽에서 강제하는 것이 재발을 막는다.

- **[INFO]** `convention_compliance.md`와 `cross_spec.md`가 동일한 CRITICAL 결함을 거의 전체 분량으로 중복 서술
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md:12-17` (CRITICAL 항목 전체) vs `review/consistency/2026/07/25/21_58_52/cross_spec.md:17-85` (CRITICAL 항목 전체)
  - 상세: 두 checker(convention_compliance, cross_spec)가 서로 독립적으로 "Cafe24/MakeShop handler 가 client 의 재throw `AbortError` 를 다시 삼켜 `§5.1 cancelled` 분류가 무력화된다"는 동일한 근본 원인을, 동일한 파일·행 번호(`cafe24.handler.ts` catch, `mapClientErrorToOutput`, `database-query.handler.ts:320` 대조군, 테스트 커버리지 갭)를 인용하며 거의 전체 분량(전자 6문단, 후자는 더 길게 "범위 확대" 절까지 포함)으로 재서술한다. 두 checker 의 관점이 명목상 다르긴 하나(전자는 "규약 준수", 후자는 "cross-spec 모순") 실제 서술 내용은 사실상 동일한 분석의 반복이다. 리뷰 산출물을 소비하는 사람/도구 입장에서는 같은 결함을 두 번 읽어야 하고, 두 문서 중 하나가 갱신되면(예: 향후 라운드에서 위치 정보가 바뀌면) 다른 하나와 어긋날 위험(중복 코드의 "한쪽만 고쳐서 불일치" 문제와 동형)이 생긴다.
  - 제안: 두 checker 중 하나(예: `cross_spec.md`)가 상세 근거를 전담하고, 다른 하나(`convention_compliance.md`)는 핵심 결론 + "상세 근거는 `cross_spec.md` CRITICAL 항목 참고"로 축약하는 컨벤션을 고려. 다만 이는 checker 설계(파이프라인 스크립트) 차원의 개선이라 이번 산출물 자체를 지금 고칠 필요는 없다.

- **[INFO]** 개별 `상세` 불릿이 여러 개의 독립적 사실을 한 문단에 몰아 담아 가독성이 낮음
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md:15` (`상세:` 불릿 — 원인 설명, 참조 구현 대조, 테스트 커버리지 갭까지 한 문장 나열), `review/consistency/2026/07/25/21_58_52/cross_spec.md:30-54` (`상세:` 불릿 — 클라이언트 수정 경위, 매핑 함수 분기 부재, WS 이벤트 미발생, 대조군 설명까지 하나의 불릿)
  - 상세: 코드의 "함수가 여러 책임을 가짐" 이슈와 동형인 문서 구조 문제다 — 하나의 `-` 불릿이 사실상 4~5개의 별개 주장(무엇이 바뀌었는지 / 왜 실패하는지 / 어디서 검증되는지 / 대조군은 어떻게 다른지)을 한 덩어리로 담아, 스캔하며 특정 사실 하나만 재확인하기 어렵다.
  - 제안: 각 CRITICAL/WARNING 항목의 `상세` 를 사실 단위로 하위 불릿(`  -`)으로 쪼개면 향후 리뷰어·resolution-applier 가 "어느 사실이 근거인지" 빠르게 대조하기 쉬워진다. 다만 이는 스타일 선호 수준의 제안이며 이번 산출물의 정확성 자체에는 영향이 없다.

## 요약

이번 diff 는 애플리케이션 코드가 아니라 consistency-checker 가 생성한 6개 리뷰 문서(마크다운 5건 + meta.json 1건)다. 문서 내용 자체는 상세하고 근거(파일·행 번호, grep 결과, RESOLUTION 문서 대조)를 촘촘히 인용해 신뢰도가 높지만, 문서 묶음으로서의 유지보수성 관점에서는 두 가지 가벼운 이탈이 있다 — (1) 5개 형제 파일 중 2개(`plan_coherence.md`, `rationale_continuity.md`)만 `## 위험도` 섹션 포맷(빈 줄 유무)이 다른 3개와 어긋나는 사소한 일관성 결함(WARNING), (2) `convention_compliance.md`와 `cross_spec.md`가 동일 CRITICAL 결함을 거의 전체 분량으로 중복 서술해 문서 간 중복이 있다(INFO). 개별 `상세` 불릿이 여러 사실을 한 문단에 몰아 담아 가독성이 다소 떨어지는 점도 INFO 로 남긴다. 이 산출물은 애플리케이션 런타임 동작에 영향을 주지 않는 리뷰 아티팩트이므로 전체 위험도는 낮게 판단한다.

## 위험도

LOW

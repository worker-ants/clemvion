import { useEffect, useState } from "react";
import {
  integrationsApi,
  type Cafe24PrecheckResult,
} from "@/lib/api/integrations";

/**
 * MakeShop shop_uid 사전 중복 감지 훅 — `useCafe24MallIdPrecheck` 의 makeshop 대응.
 *
 * `shopUid` 가 변경되면 350ms debounce 후 `GET /api/integrations/makeshop/precheck`
 * 를 호출해 동일 shop_uid 의 makeshop 통합 존재 여부를 미리 확인한다. 결과는
 * inline 경고 배너 + Connect 버튼 disabled 의 입력이 된다.
 *
 * NOTE: MakeShop 의 begin 흐름은 shop_uid 입력이 없다 (shop_uid 는 ShopStore
 * install redirect 로 도착). 따라서 본 훅은 cafe24 와의 parity·재사용을 위해
 * 제공되며, install 후 식별된 shop_uid 로 중복 여부를 표시하는 등의 surface 에서
 * 사용 가능하다. 결과 shape 은 cafe24 와 동일 (`Cafe24PrecheckResult`).
 *
 * 동작 보장:
 * - `enabled=false` 또는 shop_uid 패턴 위반 시 상태를 즉시 클리어.
 * - `shopUid` 가 바뀌면 직전 in-flight fetch 를 `AbortController.abort()` 로 취소.
 * - 응답 실패는 silent fail (backend 가드가 backstop).
 *
 * SoT: spec/2-navigation/4-integration.md §5.9 / §9.2.
 */

/**
 * MakeShop shop_uid 정규식 — backend `MakeshopPrecheckQueryDto` 의
 * `/^[A-Za-z0-9_-]{2,64}$/` 와 동일. 단일 진실 보장.
 */
export const MAKESHOP_SHOP_UID_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

/**
 * Precheck 호출 debounce — cafe24 와 동일한 350ms.
 */
export const MAKESHOP_PRECHECK_DEBOUNCE_MS = 350;

export interface UseMakeshopShopUidPrecheckResult {
  /** 충돌 결과 — null 이면 미감지 / 로딩 중 / enabled=false / 패턴 위반 */
  conflict: Cafe24PrecheckResult | null;
  /** 350ms debounce 후 backend fetch 진행 중 여부 */
  loading: boolean;
}

/**
 * `shop_uid` 입력값 기반 사전 중복 감지 훅.
 *
 * **현재 사용처**: 없음 (INFO7). MakeShop 의 begin 흐름은 shop_uid 를 사용자가
 * 입력하지 않으므로 (ShopStore 설치 redirect 로 전달됨) 현재 직접 사용하는 surface 가
 * 없다. 의도한 미래 사용 시나리오: install 완료 후 식별된 shop_uid 의 중복 여부를
 * 사용자에게 미리 표시하는 "post-install precheck" 뷰, 또는 admin 이 shop_uid 를
 * 수동 입력할 수 있는 고급 통합 설정 화면.
 *
 * @param shopUid — 식별값. 빈 문자열 또는 패턴 위반이면 fetch skip 후
 *   conflict/loading 즉시 클리어.
 * @param enabled — 호출자 가드. false 면 효과 없이 conflict null, loading false 반환.
 */
export function useMakeshopShopUidPrecheck(
  shopUid: string,
  enabled: boolean,
): UseMakeshopShopUidPrecheckResult {
  const [conflict, setConflict] = useState<Cafe24PrecheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setConflict(null);
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!MAKESHOP_SHOP_UID_PATTERN.test(shopUid)) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const result = await integrationsApi.makeshopPrecheck(shopUid, signal);
        if (!signal.aborted) setConflict(result);
      } catch {
        if (!signal.aborted) setConflict(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, MAKESHOP_PRECHECK_DEBOUNCE_MS);
    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [enabled, shopUid]);

  return { conflict, loading };
}

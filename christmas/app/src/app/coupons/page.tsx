"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "react-query";
import CouponCard from "../market/components/couponCard";
import CouponModal from "../market/components/couponModal";
import { fetchClaimedCoupons } from "../queries/queries";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { Coupon } from "@/types";

export default function Page() {
    const anchorClient = useAnchorClient();

    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);

    // fetch claimed coupons
    const {
        data: couponsBalance,
        isLoading,
        refetch,
    } = useQuery(["claimed_coupons"], () => {
        if (anchorClient !== null) {
            return fetchClaimedCoupons(anchorClient);
        }
    });

    // refetch claimed coupons as anchorClient might be null initially
    useEffect(() => {
        refetch();
    }, [anchorClient]);

    const handleCouponClick = (coupon: Coupon) => {
        setSelectedCoupon(coupon);
    };

    const handleModalClose = () => {
        setSelectedCoupon(null);
    };

    const handleRedeemCoupon = () => {
        console.log("Coupon redeemed:", selectedCoupon);
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Available Coupons</h1>
            {isLoading ? (
                <p>Loading coupons...</p>
            ) : (
                <>
                    {couponsBalance?.map(([coupon, balance]) => (
                        <CouponCard
                            key={coupon.publicKey.toString()}
                            coupon={coupon}
                            balance={balance}
                            onClick={() => handleCouponClick(coupon)}
                        />
                    ))}
                </>
            )}
            {selectedCoupon && (
                <CouponModal
                    coupon={selectedCoupon}
                    onClose={handleModalClose}
                    onRedeem={handleRedeemCoupon}
                />
            )}
        </div>
    );
}